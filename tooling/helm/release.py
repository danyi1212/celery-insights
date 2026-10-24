"""Prepare Helm metadata for a stable Celery Insights release."""

import argparse
import re
import subprocess
import sys
from pathlib import Path

import yaml

CHART = Path(__file__).resolve().parents[2] / "charts/celery-insights"
STABLE_TAG = re.compile(r"v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)")


def prepare_release(tag: str, chart: Path = CHART, *, restore_chart: bool = False) -> str:
    """Set both chart versions from a full application release tag."""
    if not STABLE_TAG.fullmatch(tag):
        raise ValueError("Helm publication requires a stable application tag such as v0.3.1")
    if restore_chart:
        root = chart.parents[1]
        subprocess.run(
            ["git", "fetch", "--depth=1", "origin", f"refs/tags/{tag}:refs/tags/{tag}"], cwd=root, check=True
        )
        subprocess.run(["git", "restore", f"--source={tag}", "--", str(chart.relative_to(root))], cwd=root, check=True)
    version = tag[1:]
    metadata_path = chart / "Chart.yaml"
    metadata = yaml.safe_load(metadata_path.read_text())
    metadata["version"] = version
    metadata["appVersion"] = version
    metadata_path.write_text(yaml.safe_dump(metadata, sort_keys=False))
    return version


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tag")
    parser.add_argument("--restore-chart", action="store_true", help="Restore the chart from the existing release tag")
    args = parser.parse_args()
    try:
        sys.stdout.write(f"{prepare_release(args.tag, restore_chart=args.restore_chart)}\n")
    except ValueError as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
