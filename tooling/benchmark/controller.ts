import semver from "semver"

/** The HTTPS measurement fixture requires the project's supported Bun runtime. */
export function requireBenchmarkController() {
  const version = process.versions.bun
  if (!version || !semver.satisfies(version, ">=1.4.2"))
    throw new Error(
      "Benchmark measurements require Bun >=1.4.2 (the project pins 1.4.2). Older controller TLS failed browser asset loads; update the controller before measuring.",
    )
}
