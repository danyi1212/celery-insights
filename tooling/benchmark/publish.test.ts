// @vitest-environment node
import { expect, test } from "vitest"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve } from "node:path"
import { publicationRecord, publishHistory } from "./publish"
import { comparisonFixture } from "./test-fixtures"
import { isolatedGitEnvironment } from "./git"

const execute = promisify(execFile)
const context = {
  repository: "owner/repo",
  sourceSha: "a".repeat(40),
  runId: 18,
  maximumAttempt: 1,
  buildRunId: 17,
  buildAttempt: 1,
}
const digest = `sha256:${"1".repeat(64)}`
async function evidence(directory: string, trusted = context, status = "passed") {
  await mkdir(resolve(directory, "run"), { recursive: true })
  const run = {
    ...comparisonFixture(),
    sourceSha: trusted.sourceSha,
    status,
    image: { ...comparisonFixture().image, reference: `ghcr.io/owner/repo@${digest}`, revision: trusted.sourceSha },
  }
  const raw = JSON.stringify(run)
  await writeFile(resolve(directory, "run/result.json"), raw)
  await writeFile(
    resolve(directory, "attempt.json"),
    JSON.stringify({
      schemaVersion: 1,
      repository: trusted.repository,
      sourceSha: trusted.sourceSha,
      measurementRunId: trusted.runId,
      measurementAttempt: trusted.maximumAttempt,
      buildRunId: trusted.buildRunId,
      buildAttempt: trusted.buildAttempt,
      status,
      resultSha256: createHash("sha256").update(raw).digest("hex"),
    }),
  )
  await writeFile(
    resolve(directory, "image.json"),
    JSON.stringify({
      schemaVersion: 1,
      repository: trusted.repository,
      sourceSha: trusted.sourceSha,
      buildRunId: trusted.buildRunId,
      buildAttempt: trusted.buildAttempt,
      variant: "regular",
      image: "ghcr.io/owner/repo",
      digest,
    }),
  )
}

test("missing and rejected artifacts publish explicit incomplete evidence, never reference metrics", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "benchmark-evidence-"))
  try {
    expect(await publicationRecord(root, context)).toMatchObject({
      status: "incomplete",
      reportError: "Measurement artifact is unavailable",
      referenceEligible: false,
      run: null,
    })
    await evidence(root)
    expect(await publicationRecord(root, context)).toMatchObject({ status: "passed", referenceEligible: true })
    await writeFile(resolve(root, "image.json"), "{}")
    expect(await publicationRecord(root, context)).toMatchObject({
      status: "incomplete",
      reportError: "Result image does not match the immutable build handoff",
      referenceEligible: false,
      run: null,
    })
    await evidence(root)
    await writeFile(resolve(root, "run/result.json"), "{}")
    expect(await publicationRecord(root, context)).toMatchObject({
      status: "incomplete",
      reportError: "Result checksum does not match the attempt",
      referenceEligible: false,
    })
    await expect(publicationRecord(root, { ...context, sourceSha: "--help" })).rejects.toThrow(
      "Invalid trusted publication context",
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("real Git publication bootstraps a separate branch, retries, preserves failures and orders by source ancestry", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "benchmark-publish-git-"))
  const source = resolve(root, "source"),
    remote = resolve(root, "remote.git"),
    input = resolve(root, "input")
  await mkdir(source)
  const git = async (cwd: string, args: string[]) =>
    (await execute("git", args, { cwd, env: isolatedGitEnvironment() })).stdout.trim()
  try {
    await git(root, ["init", "--bare", remote])
    await git(source, ["init", "--initial-branch=main"])
    await git(source, ["config", "user.name", "Benchmark test"])
    await git(source, ["config", "user.email", "benchmark@example.invalid"])
    await git(source, ["config", "commit.gpgsign", "false"])
    await git(source, ["remote", "add", "origin", remote])
    const shas: string[] = []
    for (const value of ["first", "second", "third", "fourth"]) {
      await writeFile(resolve(source, "application.txt"), value)
      await git(source, ["add", "application.txt"])
      await git(source, ["commit", "-m", value])
      shas.push(await git(source, ["rev-parse", "HEAD"]))
    }
    await git(source, ["push", "origin", "main"])
    const runs = [0, 2, 1, 3].map((index) => ({ ...context, sourceSha: shas[index], runId: 18 + index }))
    for (const trusted of runs) {
      await evidence(input, trusted, trusted.sourceSha === shas[3] ? "failed" : "passed")
      expect((await publishHistory(source, input, trusted)).alreadyPublished).toBe(false)
      expect((await publishHistory(source, input, trusted)).alreadyPublished).toBe(true)
    }
    const index = JSON.parse(await git(root, ["--git-dir", remote, "show", "benchmark-results:index.json"]))
    expect(index.latest).toBe(`${shas[3]}/21-1`)
    expect(index.entries).toHaveLength(4)
    const comparison = JSON.parse(
      await git(root, ["--git-dir", remote, "show", `benchmark-results:runs/${shas[1]}/19-1.comparison.json`]),
    )
    expect(comparison.rollingReference.baseline.sourceSha).toBe(shas[0])
    expect(await git(source, ["status", "--porcelain"])).toBe("")
    expect(await git(source, ["rev-parse", "HEAD"])).toBe(shas[3])
    expect(await readFile(resolve(source, "application.txt"), "utf8")).toBe("fourth")
    const files = await git(root, ["--git-dir", remote, "ls-tree", "--name-only", "benchmark-results"])
    expect(files.split("\n")).toEqual(["README.md", "index.json", "runs", "trends.svg"])
    expect((await git(source, ["worktree", "list", "--porcelain"])).match(/worktree /g)).toHaveLength(1)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)
