"""Real Kubernetes lifecycle tests. Run against a disposable Kind context only.

Load celery-insights-helm:e2e and celery-insights-test-project:local into Kind first.
Test infrastructure belongs only to this harness, never to the application chart.
"""

import asyncio
import base64
import json
import os
import secrets
import socket
import subprocess
import tempfile
import time
import unittest
from contextlib import contextmanager
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import websockets
import yaml

ROOT = Path(__file__).resolve().parents[2]
CHART = ROOT / "charts/celery-insights"
NAMESPACE = "celery-helm-e2e"


def command(*args, data=None):
    result = subprocess.run(args, input=data, capture_output=True, text=True, check=True)
    return result.stdout


def kube(*args, data=None):
    return command("kubectl", "--namespace", NAMESPACE, *args, data=data)


def poll(check, timeout=120):
    deadline = time.monotonic() + timeout
    last_error = None
    while time.monotonic() < deadline:
        try:
            value = check()
            if value:
                return value
        except (HTTPError, URLError, OSError, subprocess.CalledProcessError) as error:
            last_error = type(error).__name__
        time.sleep(1)
    raise AssertionError(f"Condition timed out after {timeout}s; last failure: {last_error}")


def request(url, method="GET", body=None, headers=None):
    req = Request(url, data=body.encode() if body is not None else None, method=method, headers=headers or {})
    with urlopen(req, timeout=10) as response:
        content = response.read().decode()
        return json.loads(content) if response.headers.get_content_type() == "application/json" else content


@contextmanager
def forward(target, remote_port):
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    with tempfile.TemporaryFile(mode="w+") as logs:
        proc = subprocess.Popen(
            ["kubectl", "-n", NAMESPACE, "port-forward", target, f"{port}:{remote_port}"], stdout=logs, stderr=logs
        )
        try:

            def connected():
                if proc.poll() is not None:
                    raise AssertionError("port-forward exited")
                with socket.create_connection(("127.0.0.1", port), timeout=1):
                    return True

            poll(connected, 30)
            yield f"http://127.0.0.1:{port}"
        finally:
            proc.terminate()
            proc.wait(timeout=15)


class HelmLifecycle(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        context = command("kubectl", "config", "current-context").strip()
        if not context.startswith("kind-"):
            raise RuntimeError("This destructive fixture is restricted to disposable Kind clusters")
        if "celery-helm" not in context:
            raise RuntimeError("Use a dedicated Kind cluster named celery-helm or celery-helm-ci")
        command("kubectl", "create", "namespace", NAMESPACE)
        cls.password = secrets.token_urlsafe(24)
        cls.frontend_password = secrets.token_urlsafe(24)
        credentials = {
            "apiVersion": "v1",
            "kind": "Secret",
            "metadata": {"name": "celery-insights-credentials"},
            "stringData": {
                "broker-url": f"amqp://fixture:{cls.password}@rabbitmq/",
                "result-backend": "redis://redis:6379/0",
                "surrealdb-root-user": "helm-admin",
                "surrealdb-root-password": cls.password,
                "surrealdb-ingester-password": secrets.token_urlsafe(24),
                "frontend-password": cls.frontend_password,
                "fixture-broker-password": cls.password,
            },
        }
        kube("apply", "-f", "-", data=yaml.safe_dump(credentials))
        documents = []
        env = [
            {
                "name": "BROKER_URL",
                "valueFrom": {"secretKeyRef": {"name": "celery-insights-credentials", "key": "broker-url"}},
            },
            {
                "name": "RESULT_BACKEND",
                "valueFrom": {"secretKeyRef": {"name": "celery-insights-credentials", "key": "result-backend"}},
            },
        ]
        for name, image, port, args, extra in [
            (
                "rabbitmq",
                "rabbitmq:4.3.6-management-alpine",
                5672,
                None,
                [
                    {"name": "RABBITMQ_DEFAULT_USER", "value": "fixture"},
                    {
                        "name": "RABBITMQ_DEFAULT_PASS",
                        "valueFrom": {
                            "secretKeyRef": {"name": "celery-insights-credentials", "key": "fixture-broker-password"}
                        },
                    },
                ],
            ),
            ("redis", "redis:8.10.2-alpine", 6379, None, []),
            (
                "worker",
                "celery-insights-test-project:local",
                None,
                ["celery", "-A", "celery_app", "worker", "-l", "INFO", "-c", "2"],
                env,
            ),
            (
                "interactive",
                "celery-insights-test-project:local",
                8000,
                ["uvicorn", "producer.interactive:app", "--host", "0.0.0.0", "--port", "8000"],
                env,
            ),
        ]:
            container = {"name": name, "image": image, "imagePullPolicy": "IfNotPresent", "env": extra}
            if args:
                container["command"] = args
            if port:
                container["ports"] = [{"containerPort": port}]
                documents.append(
                    {
                        "apiVersion": "v1",
                        "kind": "Service",
                        "metadata": {"name": name},
                        "spec": {"selector": {"fixture": name}, "ports": [{"port": port, "targetPort": port}]},
                    }
                )
            documents.append(
                {
                    "apiVersion": "apps/v1",
                    "kind": "Deployment",
                    "metadata": {"name": name},
                    "spec": {
                        "replicas": 1,
                        "selector": {"matchLabels": {"fixture": name}},
                        "template": {"metadata": {"labels": {"fixture": name}}, "spec": {"containers": [container]}},
                    },
                }
            )
        kube("apply", "-f", "-", data=yaml.safe_dump_all(documents))
        kube("rollout", "status", "deployment/interactive", "--timeout=180s")
        cls.values = {
            "image": {"repository": "celery-insights-helm", "tag": "e2e", "pullPolicy": "Never"},
            "replicaCount": 2,
            "config": {
                "env": {
                    "URL_PREFIX": "/tools/celery",
                    "INGESTION_LOCK_TTL_SECONDS": "10",
                    "INGESTION_LOCK_HEARTBEAT_SECONDS": "2",
                },
                "python": {
                    "content": (
                        "import os\n"
                        "broker_url = os.environ['BROKER_URL']\n"
                        "result_backend = os.environ['RESULT_BACKEND']\n"
                    )
                },
            },
        }

    @classmethod
    def tearDownClass(cls):
        if os.environ.get("HELM_E2E_KEEP") != "1":
            kube("delete", "namespace", NAMESPACE, "--wait=false")

    def helm(self, release, values):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml") as file:
            yaml.safe_dump(values, file)
            file.flush()
            command(
                "helm",
                "upgrade",
                "--install",
                release,
                str(CHART),
                "-n",
                NAMESPACE,
                "-f",
                file.name,
                "--wait",
                "--timeout",
                "5m",
            )

    def app_pods(self, release="memory"):
        data = json.loads(
            kube(
                "get",
                "pods",
                "-l",
                f"app.kubernetes.io/name=celery-insights,app.kubernetes.io/instance={release}",
                "-o",
                "json",
            )
        )
        return [
            p["metadata"]["name"]
            for p in data["items"]
            if not p["metadata"].get("deletionTimestamp")
            and any(c.get("type") == "Ready" and c["status"] == "True" for c in p["status"].get("conditions", []))
        ]

    def sql(self, base, query):
        headers = {
            "Accept": "application/json",
            "Authorization": "Basic " + base64.b64encode(f"helm-admin:{self.password}".encode()).decode(),
        }
        return request(base + "/tools/celery/surreal/sql", "POST", query, headers)

    def trigger(self, interactive, base):
        # Warm up the event receiver before asserting terminal state.
        def received():
            task = request(interactive + "/scenarios/add", "POST")["task_id"]
            try:
                poll(
                    lambda: (
                        self.sql(base, f"USE NS celery_insights DB main; SELECT state FROM task:⟨{task}⟩;")[1]
                        .get("result", [{}])[0]
                        .get("state")
                        == "SUCCESS"
                    ),
                    15,
                )
                return task
            except AssertionError, IndexError:
                return False

        return poll(received, 90)

    async def live_query(self, base, interactive):
        async with websockets.connect(
            base.replace("http:", "ws:") + "/tools/celery/surreal/rpc", open_timeout=10
        ) as ws:
            for ident, method, params in [
                (1, "signin", [{"user": "helm-admin", "pass": self.password}]),
                (2, "use", ["celery_insights", "main"]),
                (3, "query", ["LIVE SELECT * FROM task;", {}]),
            ]:
                await ws.send(json.dumps({"id": ident, "method": method, "params": params}))
                result = json.loads(await asyncio.wait_for(ws.recv(), 10))
                self.assertNotIn("error", result)
            task = await asyncio.to_thread(request, interactive + "/scenarios/add", "POST")
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline:
                event = await asyncio.wait_for(ws.recv(), 30)
                if task["task_id"] in event:
                    return
            self.fail("No live query notification for the produced task")

    def test_01_memory_replicas_failover_and_browser(self):
        self.helm("memory", self.values)
        pods = poll(lambda: self.app_pods() if len(self.app_pods()) == 2 else None)
        with forward("service/interactive", 8000) as interactive:
            statuses = {}
            for pod in pods:
                with forward("pod/" + pod, 8555) as base:
                    statuses[pod] = request(base + "/health")["ingestionStatus"]
                    self.assertIn("celery_tasks_total", request(base + "/tools/celery/metrics"))
                    self.assertIn("surrealdb", request(base + "/tools/celery/api/settings/info"))
                    task = self.trigger(interactive, base)
                    poll(
                        lambda: (
                            request(base + "/tools/celery/api/settings/info")["ingestion"]["events_ingested_total"] > 0
                        )
                    )
                    self.assertIn(
                        "celery_insights_events_ingested_total", request(base + "/tools/celery/metrics/system")
                    )
                    retention = {
                        "cleanup_interval_seconds": 60,
                        "task_max_count": 500,
                        "task_retention_hours": 48,
                        "dead_worker_retention_hours": 24,
                    }
                    if pod == pods[0]:
                        request(
                            base + "/tools/celery/api/settings/retention",
                            "PUT",
                            json.dumps(retention),
                            {"Content-Type": "application/json"},
                        )
                    self.assertEqual(request(base + "/tools/celery/api/settings/retention")["settings"], retention)
                    asyncio.run(self.live_query(base, interactive))
                    env = {
                        **os.environ,
                        "HELM_E2E_URL": base + "/tools/celery",
                        "HELM_E2E_PASSWORD": self.frontend_password,
                        "HELM_E2E_TASK": task,
                    }
                    subprocess.run(["bun", str(ROOT / "tooling/helm/browser.ts")], env=env, check=True)
            self.assertEqual(sorted(statuses.values()), ["leader", "standby"])
            leader = next(pod for pod, status in statuses.items() if status == "leader")
            standby = next(pod for pod, status in statuses.items() if status == "standby")
            # Crash PID 1 to leave the lease behind, rather than exercising only
            # graceful SIGTERM/release. A subsequent query must reclaim expiry.
            pod = json.loads(kube("get", "pod", leader, "-o", "json"))
            container = pod["status"]["containerStatuses"][0]["containerID"].removeprefix("containerd://")
            command("docker", "exec", pod["spec"]["nodeName"], "crictl", "stop", "--timeout", "0", container)
            kube("delete", "pod", leader, "--wait=false")

            # A replacement may win before the original standby. Both are valid
            # successors; all replicas must keep serving the API during election.
            def successor():
                leaders = []
                for pod in self.app_pods():
                    if pod == leader:
                        continue
                    with forward("pod/" + pod, 8555) as candidate:
                        if request(candidate + "/health")["ingestionStatus"] == "leader":
                            leaders.append(pod)
                return leaders[0] if len(leaders) == 1 else None

            elected = poll(successor, 90)
            with forward("pod/" + standby, 8555) as base:
                self.assertIn("celery_tasks_total", request(base + "/tools/celery/metrics"))
            with forward("pod/" + elected, 8555) as base:
                self.trigger(interactive, base)
            # A config change rolls pods without creating an isolated database.
            updated = {**self.values, "podAnnotations": {"e2e-rollout": "second"}}
            self.helm("memory", updated)
            command("helm", "test", "memory", "-n", NAMESPACE, "--timeout", "90s")
        command("helm", "uninstall", "memory", "-n", NAMESPACE, "--wait")
        self.assertIn("celery-insights-credentials", kube("get", "secret", "celery-insights-credentials", "-o", "name"))

    def test_02_persistence_external_and_retention(self):
        values = {
            **self.values,
            "replicaCount": 1,
            "surrealdb": {"surrealdb": {"path": "rocksdb:/data/surreal"}, "persistence": {"enabled": True}},
        }
        self.helm("durable", values)
        with (
            forward("service/interactive", 8000) as interactive,
            forward("service/durable-celery-insights", 80) as base,
        ):
            task = self.trigger(interactive, base)
        kube("rollout", "restart", "deployment/durable-surrealdb")
        kube("rollout", "status", "deployment/durable-surrealdb", "--timeout=180s")
        kube("rollout", "restart", "deployment/durable-celery-insights")
        kube("rollout", "status", "deployment/durable-celery-insights", "--timeout=180s")
        with forward("service/durable-celery-insights", 80) as base:
            poll(
                lambda: (
                    self.sql(base, f"USE NS celery_insights DB main; SELECT state FROM task:⟨{task}⟩;")[1]["result"][0][
                        "state"
                    ]
                    == "SUCCESS"
                )
            )
        # A second release connects to the existing shared database without provisioning one.
        external = {
            **self.values,
            "surrealdb": {"enabled": False},
            "database": {"externalUrl": "ws://durable-surrealdb:8000/rpc"},
        }
        self.helm("external", external)
        with forward("service/external-celery-insights", 80) as base:
            self.assertIn("celery_tasks_total", request(base + "/tools/celery/metrics"))
            self.assertEqual(
                self.sql(base, f"USE NS celery_insights DB main; SELECT state FROM task:⟨{task}⟩;")[1]["result"][0][
                    "state"
                ],
                "SUCCESS",
            )
        command("helm", "uninstall", "external", "-n", NAMESPACE, "--wait")
        command("helm", "uninstall", "durable", "-n", NAMESPACE, "--wait")
        self.assertIn("durable-surrealdb", kube("get", "pvc", "durable-surrealdb", "-o", "name"))
        # Reinstall with an operator-owned claim; no adoption/creation/deletion by Helm.
        reused = {
            **self.values,
            "replicaCount": 1,
            "surrealdb": {
                "surrealdb": {"path": "rocksdb:/data/surreal"},
                "persistence": {"enabled": False},
                "volumes": [{"name": "existing-data", "persistentVolumeClaim": {"claimName": "durable-surrealdb"}}],
                "volumeMounts": [{"name": "existing-data", "mountPath": "/data"}],
            },
        }
        self.helm("reused", reused)
        with forward("service/reused-celery-insights", 80) as base:
            self.assertEqual(
                self.sql(base, f"USE NS celery_insights DB main; SELECT state FROM task:⟨{task}⟩;")[1]["result"][0][
                    "state"
                ],
                "SUCCESS",
            )
        command("helm", "uninstall", "reused", "-n", NAMESPACE, "--wait")
        self.assertIn("durable-surrealdb", kube("get", "pvc", "durable-surrealdb", "-o", "name"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
