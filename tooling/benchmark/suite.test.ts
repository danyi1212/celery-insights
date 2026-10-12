// @vitest-environment node
import { expect, test } from "vitest"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve } from "node:path"
import { suiteManifest } from "./suite"

const manifest = () => ({
  schemaVersion: 1,
  scenarios: [{ name: "small", repetitions: 1, args: ["--tasks", "32"], environment: { BENCH_CPU: "1" } }],
})
test("suite manifests reject output escape, unsafe environments and duplicate names", () => {
  expect(suiteManifest(manifest()).scenarios).toHaveLength(1)
  for (const args of [["--output", "/tmp/other"], ["compare"], [1]]) {
    expect(() => suiteManifest({ ...manifest(), scenarios: [{ ...manifest().scenarios[0], args }] })).toThrow(
      "Invalid scenario",
    )
  }
  expect(() =>
    suiteManifest({ ...manifest(), scenarios: [{ ...manifest().scenarios[0], environment: { HOME: "/tmp" } }] }),
  ).toThrow("Invalid scenario")
  expect(() => suiteManifest({ ...manifest(), scenarios: [manifest().scenarios[0], manifest().scenarios[0]] })).toThrow(
    "Invalid scenario",
  )
})

test("real suite CLI retains every failed setup attempt and exits nonzero", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "benchmark-suite-"))
  try {
    const file = resolve(root, "manifest.json"),
      output = resolve(root, "output")
    const input = manifest()
    input.scenarios[0].args = ["--tasks", "0"]
    input.scenarios[0].repetitions = 2
    await writeFile(file, JSON.stringify(input))
    const execute = promisify(execFile)
    await expect(
      execute("bun", [
        "run",
        "tooling/benchmark/cli.ts",
        "suite",
        "--manifest",
        file,
        "--output",
        output,
        "--image",
        "unused",
      ]),
    ).rejects.toMatchObject({ code: 1 })
    const summary = JSON.parse(await readFile(resolve(output, "suite.json"), "utf8"))
    expect(summary.attempts).toHaveLength(2)
    expect(summary.attempts.every((attempt: { status: string }) => attempt.status === "incomplete")).toBe(true)
    expect(await readFile(resolve(output, "small-1.log"), "utf8")).toContain("must be a positive integer")
    expect(await readFile(resolve(output, "small-2.log"), "utf8")).toContain("must be a positive integer")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
