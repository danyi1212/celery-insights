"""Execute the workflow's actual attempt scripts against failed/missing reports."""

import hashlib
import json
import subprocess
import sys
from pathlib import Path

import pytest
import yaml


@pytest.mark.parametrize(
    ("raw", "expected_status", "expected_error"),
    [
        (None, "incomplete", False),
        ("null", "incomplete", False),
        ("{broken", "incomplete", True),
        (json.dumps({"sourceSha": "b" * 40, "status": "passed"}), "incomplete", True),
        (
            json.dumps({"sourceSha": "a" * 40, "status": "passed", "executionContractVersion": 1}),
            "incomplete",
            True,
        ),
        (
            json.dumps({"sourceSha": "a" * 40, "status": "failed", "pipeline": None, "requests": None}),
            "failed",
            False,
        ),
    ],
)
def test_attempt_retains_failure_and_never_invents_missing_metrics(tmp_path, raw, expected_status, expected_error):
    workflow = yaml.safe_load(Path(".github/workflows/benchmark.yml").read_text())
    steps = {step["name"]: step for step in workflow["jobs"]["measure"]["steps"] if "name" in step}
    environment = {
        "RUNNER_TEMP": str(tmp_path),
        "GITHUB_ENV": str(tmp_path / "environment"),
        "GITHUB_STEP_SUMMARY": str(tmp_path / "summary"),
        "GITHUB_REPOSITORY": "owner/repo",
        "SOURCE_SHA": "a" * 40,
        "BUILD_RUN_ID": "17",
        "BUILD_ATTEMPT": "2",
        "GITHUB_RUN_ID": "18",
        "GITHUB_RUN_ATTEMPT": "1",
        "MEASUREMENT_OUTCOME": "failure" if raw else "skipped",
    }

    def execute(name):
        script = steps[name]["run"].split("python - <<'PY'\n", 1)[1].rsplit("\nPY", 1)[0]
        subprocess.run([sys.executable, "-c", script], env=environment, check=True, capture_output=True)

    execute("Record attempt before setup")
    root = tmp_path / "benchmark-attempt"
    environment["BENCH_OUTPUT"] = str(root)
    if raw is not None:
        (root / "run").mkdir()
        (root / "run/result.json").write_text(raw)
    execute("Finalize attempt and job summary")
    attempt = json.loads((root / "attempt.json").read_text())
    assert attempt["status"] == expected_status
    assert ("reportError" in attempt) == expected_error
    assert attempt["resultSha256"] == (hashlib.sha256(raw.encode()).hexdigest() if raw is not None else None)
    assert attempt["sourceSha"] == "a" * 40
    assert attempt["artifactRetentionDays"] == 30
    assert "dropped scheduled requests: unavailable" in (tmp_path / "summary").read_text()
