"""Verify existing datastore upgrade and old-version export restoration."""

import logging
import os
import pathlib
import signal
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from contextlib import contextmanager

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)
root = pathlib.Path(tempfile.mkdtemp(prefix="celery-surreal-upgrade-"))
project = pathlib.Path(__file__).resolve().parents[1]
bun = os.environ.get("BUN_BINARY", "bun")
logger.info("Validation evidence: %s", root)
args = [
    "--endpoint",
    "http://127.0.0.1:18558",
    "--username",
    "root",
    "--password",
    "root",
    "--namespace",
    "celery_insights",
    "--database",
    "main",
]


@contextmanager
def server(version, storage):
    binary = pathlib.Path(os.environ["SURREAL_OLD_BINARY" if version == "3.0.2" else "SURREAL_NEW_BINARY"])
    with (root / f"{version}-{storage}.log").open("w") as log:
        process = subprocess.Popen(
            [
                str(binary),
                "start",
                "--bind",
                "127.0.0.1:18558",
                "--username",
                "root",
                "--password",
                "root",
                f"surrealkv://{root / storage}",
            ],
            stdout=log,
            stderr=log,
        )
        try:
            for _ in range(120):
                if process.poll() is not None:
                    raise RuntimeError(f"Database exited; see {log.name}")
                try:
                    with urllib.request.urlopen("http://127.0.0.1:18558/health", timeout=1):
                        break
                except urllib.error.URLError, OSError:
                    time.sleep(0.25)
            else:
                raise RuntimeError("Database startup timed out")
            yield binary
        finally:
            if process.poll() is None:
                process.send_signal(signal.SIGINT)
                try:
                    process.wait(timeout=30)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=10)


def check(mode, label):
    output = subprocess.check_output(
        [bun, str(project / "tooling/verify-surreal-data.ts"), mode],
        text=True,
        stderr=subprocess.STDOUT,
    )
    (root / f"{label}.log").write_text(output)
    logger.info("%s PASS", label)


with server("3.0.2", "persisted-data") as binary:
    check("seed", "old-seed")
    subprocess.run([str(binary), "export", *args, str(root / "pre-upgrade.surql")], check=True)
with server("3.3.0", "persisted-data"):
    check("check", "in-place-upgrade")
with server("3.3.0", "restored-data") as binary:
    subprocess.run([str(binary), "import", *args, str(root / "pre-upgrade.surql")], check=True)
    check("check", "backup-restore")
