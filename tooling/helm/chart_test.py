"""Offline contract tests. Run after helm dependency build charts/celery-insights."""

import json
import subprocess
import tempfile
import tomllib
import unittest
from pathlib import Path

import yaml

CHART = Path(__file__).resolve().parents[2] / "charts/celery-insights"


def render(values=None, *, success=True):
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json") as fixture:
        json.dump(values or {}, fixture)
        fixture.flush()
        result = subprocess.run(
            ["helm", "template", "contract", str(CHART), "--kube-version", "1.35.0", "-f", fixture.name],
            capture_output=True,
            text=True,
        )
    if not success:
        assert result.returncode != 0, "Invalid values unexpectedly rendered"
        return result.stderr
    assert result.returncode == 0, result.stderr
    return [r for r in yaml.safe_load_all(result.stdout) if r]


def resource(resources, kind, name):
    return next(r for r in resources if r["kind"] == kind and r["metadata"]["name"] == name)


class ChartContract(unittest.TestCase):
    def test_default_is_shared_private_memory_database(self):
        manifests = render()
        db = resource(manifests, "Deployment", "contract-surrealdb")
        app = resource(manifests, "Deployment", "contract-celery-insights")
        self.assertEqual(db["spec"]["replicas"], 1)
        self.assertEqual(db["spec"]["strategy"]["type"], "Recreate")
        env = {v["name"]: v for v in app["spec"]["template"]["spec"]["containers"][0]["env"]}
        self.assertEqual(env["SURREALDB_EXTERNAL_URL"]["value"], "ws://contract-surrealdb:8000/rpc")
        self.assertIn("secretKeyRef", env["BROKER_URL"]["valueFrom"])
        self.assertFalse(any(r["kind"] == "PersistentVolumeClaim" for r in manifests))

    def test_persistent_and_existing_claim_profiles(self):
        manifests = render(yaml.safe_load((CHART / "examples/persistent.yaml").read_text()))
        pvc = resource(manifests, "PersistentVolumeClaim", "contract-surrealdb")
        self.assertEqual(pvc["metadata"]["annotations"]["helm.sh/resource-policy"], "keep")
        manifests = render(yaml.safe_load((CHART / "examples/existing-claim.yaml").read_text()))
        self.assertFalse(any(r["kind"] == "PersistentVolumeClaim" for r in manifests))
        db = resource(manifests, "Deployment", "contract-surrealdb")
        self.assertEqual(
            db["spec"]["template"]["spec"]["volumes"][0]["persistentVolumeClaim"]["claimName"], "surrealdb-data"
        )

    def test_external_has_no_database_resources(self):
        manifests = render({"surrealdb": {"enabled": False}, "database": {"externalUrl": "wss://example.com/rpc"}})
        self.assertFalse(any(r["metadata"]["name"].startswith("contract-surrealdb") for r in manifests))

    def test_cpu_hpa_owns_replica_count(self):
        app = resource(render({"autoscaling": {"enabled": True}}), "Deployment", "contract-celery-insights")
        self.assertNotIn("replicas", app["spec"])
        hpa = resource(
            render({"autoscaling": {"enabled": True}}), "HorizontalPodAutoscaler", "contract-celery-insights"
        )
        self.assertEqual(hpa["spec"]["metrics"][0]["resource"]["name"], "cpu")

    def test_structured_toml_round_trips_and_coexists_with_python(self):
        config = {
            "schema_version": 1,
            "logging": {"format": "json"},
            "ui": {"demo_available": False},
            "groups": ["one", "two"],
            "message": 'quote " and newline\n',
        }
        manifests = render(
            {
                "config": {
                    "toml": {"enabled": True, "structured": config},
                    "python": {"content": "broker_url = 'amqp://test/'"},
                }
            }
        )
        cm = resource(manifests, "ConfigMap", "contract-celery-insights-config")
        self.assertEqual(tomllib.loads(cm["data"]["config.toml"]), config)
        self.assertIn("config.py", cm["data"])

    def test_raw_files_and_existing_sources(self):
        raw = 'schema_version = 1\n[logging]\nformat = "json"\n'
        cm = resource(
            render({"config": {"toml": {"enabled": True, "content": raw}}}),
            "ConfigMap",
            "contract-celery-insights-config",
        )
        self.assertEqual(tomllib.loads(cm["data"]["config.toml"]), tomllib.loads(raw))
        manifests = render(
            {
                "config": {
                    "toml": {"enabled": True, "existingConfigMap": "operator"},
                    "python": {"existingSecret": "sensitive"},
                }
            }
        )
        self.assertFalse(any(r["kind"] == "ConfigMap" for r in manifests))
        app = resource(manifests, "Deployment", "contract-celery-insights")
        volumes = app["spec"]["template"]["spec"]["volumes"]
        self.assertEqual(volumes[0]["configMap"]["name"], "operator")
        self.assertEqual(volumes[1]["secret"]["secretName"], "sensitive")

    def test_config_changes_restart_pods(self):
        def checksum(content):
            app = resource(
                render({"config": {"python": {"content": content}}}), "Deployment", "contract-celery-insights"
            )
            return app["spec"]["template"]["metadata"]["annotations"]["checksum/config"]

        self.assertNotEqual(checksum("x = 1"), checksum("x = 2"))

    def test_ingress_and_digest(self):
        manifests = render(
            {
                "ingress": {
                    "enabled": True,
                    "className": "nginx",
                    "tls": [{"secretName": "tls", "hosts": ["insights.example.com"]}],
                },
                "image": {"digest": "sha256:" + "a" * 64},
            }
        )
        ingress = resource(manifests, "Ingress", "contract-celery-insights")
        self.assertEqual(ingress["spec"]["tls"][0]["secretName"], "tls")
        app = resource(manifests, "Deployment", "contract-celery-insights")
        self.assertIn("@sha256:", app["spec"]["template"]["spec"]["containers"][0]["image"])

    def test_invalid_combinations_fail_actionably(self):
        cases = [
            ({"surrealdb": {"podExtraEnv": []}}, "requires both"),
            ({"surrealdb": {"surrealdb": {"path": "rocksdb:/data/surreal"}}}, "existing PVC"),
            ({"surrealdb": {"replicaCount": 2}}, "one instance"),
            ({"surrealdb": {"horizontalPodAutoscaler": {"enabled": True}}}, "one instance"),
            ({"database": {"externalUrl": "ws://example.com/rpc"}}, "not both"),
            ({"surrealdb": {"enabled": False}}, "externalUrl"),
            ({"surrealdb": {"persistence": {"enabled": True}}}, "PVC persistence"),
            ({"config": {"toml": {"enabled": True, "content": "x=1", "structured": {"x": 1}}}}, "exactly one source"),
            ({"config": {"toml": {"content": "x=1"}}}, "enabled=true"),
            ({"config": {"env": {"SURREALDB_ROOT_PASS": "do-not-render"}}}, "Secret references"),
            ({"extraEnv": [{"name": "PORT", "value": "9999"}]}, "duplicates"),
            ({"autoscaling": {"minReplicas": 3, "maxReplicas": 2}}, "minReplicas"),
            ({"replicaCount": 0}, "minimum"),
        ]
        for values, message in cases:
            with self.subTest(values=values):
                self.assertIn(message, render(values, success=False))


if __name__ == "__main__":
    unittest.main(verbosity=2)
