"""Release tests use the workflow's metadata step and a real Helm package."""

import os
import shlex
import shutil
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path

import yaml

from tooling.helm.release import CHART, prepare_release

ROOT = CHART.parents[1]


class HelmRelease(unittest.TestCase):
    def test_stable_tag_sets_both_versions_and_preserves_dependencies(self):
        with tempfile.TemporaryDirectory() as directory:
            chart = Path(directory)
            metadata = yaml.safe_load((CHART / "Chart.yaml").read_text())
            (chart / "Chart.yaml").write_text(yaml.safe_dump(metadata))
            self.assertEqual(prepare_release("v2.4.6", chart), "2.4.6")
            prepared = yaml.safe_load((chart / "Chart.yaml").read_text())
            self.assertEqual(prepared["version"], "2.4.6")
            self.assertEqual(prepared["appVersion"], "2.4.6")
            self.assertEqual(prepared["dependencies"], metadata["dependencies"])

    def test_rejects_prerelease_and_malformed_tags_without_changing_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            chart = Path(directory)
            original = (CHART / "Chart.yaml").read_text()
            (chart / "Chart.yaml").write_text(original)
            for tag in ["v0.3.1-rc.1", "v0.3.1+build", "chart-v0.3.1", "0.3.1", "v01.2.3", "v1.2", "v1.2.3\n"]:
                with self.subTest(tag=tag):
                    with self.assertRaisesRegex(ValueError, "stable application tag"):
                        prepare_release(tag, chart)
                    self.assertEqual((chart / "Chart.yaml").read_text(), original)

    def test_workflow_metadata_step_packages_the_matching_application_image(self):
        workflow = yaml.load((ROOT / ".github/workflows/publish-chart.yml").read_text(), Loader=yaml.BaseLoader)
        step = next(step for step in workflow["jobs"]["publish"]["steps"] if step.get("id") == "release")
        with tempfile.TemporaryDirectory() as directory:
            checkout = Path(directory)
            chart = checkout / "charts/celery-insights"
            shutil.copytree(CHART, chart)
            shutil.copytree(
                ROOT / "tooling/helm", checkout / "tooling/helm", ignore=shutil.ignore_patterns("__pycache__")
            )
            output = checkout / "github-output"
            # Run the actual workflow commands without creating a second uv
            # environment. Both commands still use the real release module.
            command = step["run"].replace("uv sync --locked", "").replace("uv run python", shlex.quote(sys.executable))
            subprocess.run(
                ["bash", "-e", "-c", command],
                cwd=checkout,
                env={**os.environ, "RELEASE_TAG": "v2.4.6", "GITHUB_OUTPUT": str(output), "GITHUB_EVENT_NAME": "push"},
                check=True,
                capture_output=True,
                text=True,
            )
            self.assertEqual(output.read_text(), "version=2.4.6\n")
            subprocess.run(["helm", "package", str(chart), "--destination", directory], check=True, capture_output=True)
            package = checkout / "celery-insights-2.4.6.tgz"
            with tarfile.open(package) as archive:
                metadata = yaml.safe_load(archive.extractfile("celery-insights/Chart.yaml"))
            self.assertEqual((metadata["version"], metadata["appVersion"]), ("2.4.6", "2.4.6"))
            rendered = subprocess.run(
                ["helm", "template", "release", str(package), "--kube-version", "1.35.0"],
                check=True,
                capture_output=True,
                text=True,
            )
            deployment = next(
                resource
                for resource in yaml.safe_load_all(rendered.stdout)
                if resource
                and resource["kind"] == "Deployment"
                and resource["metadata"]["name"] == "release-celery-insights"
            )
            self.assertEqual(
                deployment["spec"]["template"]["spec"]["containers"][0]["image"],
                "ghcr.io/danyi1212/celery-insights:2.4.6",
            )

    def test_chart_publication_waits_for_images_and_has_no_independent_trigger(self):
        deploy = yaml.load((ROOT / ".github/workflows/deploy.yml").read_text(), Loader=yaml.BaseLoader)
        job = deploy["jobs"]["publish-chart"]
        self.assertEqual(job["needs"], "build-and-push-image")
        self.assertEqual(job["uses"], "./.github/workflows/publish-chart.yml")
        self.assertEqual(job["with"]["release-tag"], "${{ github.ref_name }}")
        self.assertIn("github.event_name == 'push'", job["if"])
        self.assertIn("startsWith(github.ref, 'refs/tags/v')", job["if"])
        self.assertIn("!contains(github.ref_name, '-')", job["if"])
        self.assertIn("!contains(github.ref_name, '+')", job["if"])
        publish = yaml.load((ROOT / ".github/workflows/publish-chart.yml").read_text(), Loader=yaml.BaseLoader)
        self.assertEqual(set(publish["on"]), {"workflow_call", "workflow_dispatch"})

    def test_retry_restores_the_release_chart_without_changing_the_tag_or_validator(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            chart = root / "charts/celery-insights"
            chart.mkdir(parents=True)
            metadata = {
                "apiVersion": "v2",
                "name": "celery-insights",
                "version": "0.3.1",
                "description": "Released chart",
            }
            (chart / "Chart.yaml").write_text(yaml.safe_dump(metadata))
            validator = root / "validator.txt"
            validator.write_text("Release validator")

            def git(*args):
                return subprocess.run(["git", *args], cwd=root, check=True, capture_output=True, text=True).stdout

            git("init", "--quiet")
            git("add", ".")
            git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.com", "commit", "-qm", "Release")
            git("tag", "v0.3.1")
            git("remote", "add", "origin", ".")
            release_commit = git("rev-parse", "v0.3.1")
            (chart / "Chart.yaml").write_text(yaml.safe_dump({**metadata, "description": "Unreleased chart"}))
            (chart / "new-feature.yaml").write_text("Unreleased resource")
            validator.write_text("Fixed validator")
            git("add", ".")
            git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.com", "commit", "-qm", "Next changes")
            self.assertEqual(prepare_release("v0.3.1", chart, restore_chart=True), "0.3.1")
            restored = yaml.safe_load((chart / "Chart.yaml").read_text())
            self.assertEqual(restored["description"], "Released chart")
            self.assertFalse((chart / "new-feature.yaml").exists())
            self.assertEqual(validator.read_text(), "Fixed validator")
            self.assertEqual(git("rev-parse", "v0.3.1"), release_commit)


if __name__ == "__main__":
    unittest.main(verbosity=2)
