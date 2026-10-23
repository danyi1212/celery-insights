"""Provenance checks for workflow_run build artifact handoff."""

import pytest
import subprocess
import sys
from pathlib import Path

from tooling.benchmark.image_manifest import build_manifest, resolve_image

REPOSITORY = "Owner/Celery-Insights"
SOURCE = "a" * 40
DIGEST = "sha256:" + "b" * 64


def test_exact_build_resolves_to_immutable_lowercase_registry_reference():
    manifest = build_manifest(REPOSITORY, SOURCE, 17, 2, DIGEST)
    assert resolve_image(manifest, REPOSITORY, SOURCE, 17, 2) == f"ghcr.io/owner/celery-insights@{DIGEST}"


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("repository", "other/repo"),
        ("sourceSha", "c" * 40),
        ("buildRunId", 18),
        ("buildAttempt", 1),
        ("variant", "all"),
        ("image", "ghcr.io/other/repo"),
        ("schemaVersion", 2),
        ("schemaVersion", True),
        ("schemaVersion", 1.0),
        ("buildRunId", 17.0),
        ("digest", "main"),
        ("digest", None),
    ],
)
def test_wrong_build_or_mutable_reference_is_rejected(key, value):
    manifest = {**build_manifest(REPOSITORY, SOURCE, 17, 2, DIGEST), key: value}
    with pytest.raises(ValueError):
        resolve_image(manifest, REPOSITORY, SOURCE, 17, 2)


@pytest.mark.parametrize("run_id", [0, -1, True, "17"])
def test_invalid_run_identity_is_rejected(run_id):
    with pytest.raises(ValueError):
        build_manifest(REPOSITORY, SOURCE, run_id, 2, DIGEST)


def test_cli_round_trip_and_overwrite_rejection(tmp_path):
    path = tmp_path / "image.json"
    script = Path(__file__).with_name("image_manifest.py")
    args = [
        "--repository",
        REPOSITORY,
        "--source-sha",
        SOURCE,
        "--build-run-id",
        "17",
        "--build-attempt",
        "2",
        "--path",
        str(path),
    ]
    subprocess.run([sys.executable, str(script), "create", *args, "--digest", DIGEST], check=True, capture_output=True)
    original = path.read_bytes()
    resolved = subprocess.run(
        [sys.executable, str(script), "resolve", *args], check=True, capture_output=True, text=True
    )
    assert resolved.stdout == f"ghcr.io/owner/celery-insights@{DIGEST}\n"
    retry = subprocess.run([sys.executable, str(script), "create", *args, "--digest", DIGEST], capture_output=True)
    assert retry.returncode != 0
    assert path.read_bytes() == original
