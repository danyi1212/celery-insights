"""Bind a benchmark image digest to the exact trusted main build that produced it."""

import argparse
import json
import re
import sys
from pathlib import Path


def build_manifest(repository: str, source_sha: str, build_run_id: int, build_attempt: int, digest: str) -> dict:
    if not isinstance(repository, str) or not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
        raise ValueError("Invalid repository")
    if not isinstance(source_sha, str) or not re.fullmatch(r"[0-9a-f]{40}", source_sha):
        raise ValueError("Source SHA must be a full commit SHA")
    if not isinstance(digest, str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", digest):
        raise ValueError("Image must have a sha256 digest")
    if any(type(value) is not int or value <= 0 for value in (build_run_id, build_attempt)):
        raise ValueError("Build run/attempt must be positive integers")
    return {
        "schemaVersion": 1,
        "repository": repository,
        "sourceSha": source_sha,
        "buildRunId": build_run_id,
        "buildAttempt": build_attempt,
        "variant": "regular",
        "image": f"ghcr.io/{repository.lower()}",
        "digest": digest,
    }


def resolve_image(manifest: dict, repository: str, source_sha: str, build_run_id: int, build_attempt: int) -> str:
    expected = build_manifest(repository, source_sha, build_run_id, build_attempt, manifest.get("digest", ""))
    if manifest.keys() != expected.keys() or any(
        type(manifest[key]) is not type(value) or manifest[key] != value for key, value in expected.items()
    ):
        raise ValueError("Image manifest does not match the triggering repository, source, build run and attempt")
    return f"{expected['image']}@{expected['digest']}"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["create", "resolve"])
    parser.add_argument("--repository", required=True)
    parser.add_argument("--source-sha", required=True)
    parser.add_argument("--build-run-id", required=True, type=int)
    parser.add_argument("--build-attempt", required=True, type=int)
    parser.add_argument("--digest")
    parser.add_argument("--path", required=True, type=Path)
    args = parser.parse_args()
    if args.command == "create":
        if args.digest is None:
            parser.error("create requires --digest")
        manifest = build_manifest(args.repository, args.source_sha, args.build_run_id, args.build_attempt, args.digest)
        args.path.parent.mkdir(parents=True, exist_ok=True)
        with args.path.open("x") as output:
            output.write(json.dumps(manifest, indent=2) + "\n")
    else:
        manifest = json.loads(args.path.read_text())
        if not isinstance(manifest, dict):
            raise ValueError("Image manifest must be an object")
        sys.stdout.write(
            resolve_image(manifest, args.repository, args.source_sha, args.build_run_id, args.build_attempt) + "\n"
        )


if __name__ == "__main__":
    main()
