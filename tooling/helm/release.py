"""Prepare Helm metadata for a stable Celery Insights release."""

import argparse
import re
import sys
from pathlib import Path

import yaml

CHART = Path(__file__).resolve().parents[2] / "charts/celery-insights"
STABLE_TAG = re.compile(r"v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)")


def prepare_release(tag: str, chart: Path = CHART) -> str:
    """Set both chart versions from a full application release tag."""
    if not STABLE_TAG.fullmatch(tag):
        raise ValueError("Helm publication requires a stable application tag such as v0.3.1")
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
    args = parser.parse_args()
    try:
        sys.stdout.write(f"{prepare_release(args.tag)}\n")
    except ValueError as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
