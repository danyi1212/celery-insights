import { createHash } from "node:crypto"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve } from "node:path"
import { appendHistory, historyRecord } from "./history"

import { isolatedGitEnvironment } from "./git"

const execute = promisify(execFile)
type Context = {
  repository: string
  sourceSha: string
  runId: number
  maximumAttempt: number
  buildRunId: number
  buildAttempt: number
}
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
const checksum = (value: string) => createHash("sha256").update(value).digest("hex")
async function optional(file: string) {
  try {
    return await readFile(file, "utf8")
  } catch (error) {
    if (object(error).code === "ENOENT") return null
    throw error
  }
}

// Only the triggering workflow supplies context. Artifact metadata cannot choose
// the repository, source, build or measurement run being published.
export async function publicationRecord(input: string, context: Context) {
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(context.repository) ||
    !/^[0-9a-f]{40}$/.test(context.sourceSha) ||
    [context.runId, context.maximumAttempt, context.buildRunId, context.buildAttempt].some(
      (value) => !Number.isSafeInteger(value) || value < 1,
    )
  )
    throw new Error("Invalid trusted publication context")
  const raw = await optional(resolve(input, "run/result.json"))
  const envelope = await optional(resolve(input, "attempt.json"))
  let measurementAttempt = context.maximumAttempt
  try {
    if (envelope === null) throw new Error("Measurement artifact is unavailable")
    const attempt = object(JSON.parse(envelope))
    if (attempt.buildRunId !== context.buildRunId || attempt.buildAttempt !== context.buildAttempt)
      throw new Error("Build provenance does not match the triggering workflow")
    const record = historyRecord(attempt, raw, context)
    measurementAttempt = Number(attempt.measurementAttempt)
    if (record.run !== null) {
      const manifest = object(JSON.parse((await optional(resolve(input, "image.json"))) ?? "null"))
      const image = object(object(record.run).image)
      const imageName = `ghcr.io/${context.repository.toLowerCase()}`
      if (
        manifest.schemaVersion !== 1 ||
        manifest.repository !== context.repository ||
        manifest.sourceSha !== context.sourceSha ||
        manifest.buildRunId !== context.buildRunId ||
        manifest.buildAttempt !== context.buildAttempt ||
        manifest.variant !== "regular" ||
        manifest.image !== imageName ||
        typeof manifest.digest !== "string" ||
        !/^sha256:[0-9a-f]{64}$/.test(manifest.digest) ||
        image.reference !== `${imageName}@${manifest.digest}` ||
        image.revision !== context.sourceSha
      )
        throw new Error("Result image does not match the immutable build handoff")
    }
    return record
  } catch (error) {
    // Preserve an incomplete attempt rather than treating rejected evidence as a
    // passing baseline. Hashes identify the rejected files in the raw artifact.
    return historyRecord(
      {
        schemaVersion: 1,
        repository: context.repository,
        sourceSha: context.sourceSha,
        measurementRunId: context.runId,
        measurementAttempt,
        buildRunId: context.buildRunId,
        buildAttempt: context.buildAttempt,
        status: "incomplete",
        resultSha256: raw === null ? null : checksum(raw),
        rejectedEnvelopeSha256: envelope === null ? null : checksum(envelope),
        reportError: error instanceof Error ? error.message : "Evidence validation failed",
      },
      null,
      context,
    )
  }
}

export async function publishHistory(sourceDirectory: string, input: string, context: Context) {
  const record = await publicationRecord(input, context)
  const git = async (cwd: string, args: string[], allowed = [0]) => {
    try {
      const result = await execute("git", args, {
        cwd,
        encoding: "utf8",
        timeout: 60_000,
        env: isolatedGitEnvironment(),
      })
      return { code: 0, stdout: result.stdout.trim() }
    } catch (error) {
      const code = object(error).code
      if (typeof code === "number" && allowed.includes(code)) return { code, stdout: "" }
      // Avoid copying authenticated remote URLs/headers into public evidence.
      throw new Error(`Git ${args[0]} failed; history was not published`)
    }
  }
  await git(sourceDirectory, ["cat-file", "-e", `${context.sourceSha}^{commit}`])
  const ancestor = async (older: string, newer: string) =>
    (await git(sourceDirectory, ["merge-base", "--is-ancestor", older, newer], [0, 1])).code === 0
  const remote = await git(
    sourceDirectory,
    ["ls-remote", "--exit-code", "--heads", "origin", "refs/heads/benchmark-results"],
    [0, 2],
  )
  if (remote.code === 0) await git(sourceDirectory, ["fetch", "--no-tags", "origin", "refs/heads/benchmark-results"])
  const root = await mkdtemp(resolve(tmpdir(), "benchmark-publication-"))
  const worktree = resolve(root, "results")
  const branch = `benchmark-publication-${root.split(/[\\/]/).at(-1)}`
  let attached = false
  let orphan = false
  try {
    await git(sourceDirectory, ["worktree", "add", "--detach", worktree, remote.code === 0 ? "FETCH_HEAD" : "HEAD"])
    attached = true
    if (remote.code === 2) {
      await git(worktree, ["switch", "--orphan", branch])
      orphan = true
    }
    const publisher = {
      sourceSha: (await git(sourceDirectory, ["rev-parse", "HEAD"])).stdout,
      files: Object.fromEntries(
        await Promise.all(
          ["compare.ts", "history.ts", "publish.ts", "trends.ts"].map(async (file) => [
            file,
            checksum(await readFile(new URL(file, import.meta.url), "utf8")),
          ]),
        ),
      ),
    }
    const publication = await appendHistory(worktree, record, ancestor, publisher)
    await git(worktree, ["add", "--", "runs", "index.json", "README.md", "trends.svg"])
    const changes = await git(worktree, ["diff", "--cached", "--quiet"], [0, 1])
    if (changes.code === 1) {
      await git(worktree, [
        "-c",
        "user.name=github-actions[bot]",
        "-c",
        "user.email=41898282+github-actions[bot]@users.noreply.github.com",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "-m",
        `Benchmark ${record.id}: ${String(record.status)}`,
      ])
      // Ordinary fast-forward push: concurrent/outside updates fail safely.
      await git(worktree, ["push", "origin", "HEAD:refs/heads/benchmark-results"])
    }
    return publication
  } finally {
    if (attached) await git(sourceDirectory, ["worktree", "remove", "--force", worktree])
    if (orphan) await git(sourceDirectory, ["branch", "-D", branch])
    await rm(root, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  const required = (name: string) => {
    const value = process.env[name]
    if (!value) throw new Error(`Missing ${name}`)
    return value
  }
  const context = {
    repository: required("GITHUB_REPOSITORY"),
    sourceSha: required("SOURCE_SHA"),
    runId: Number(required("GITHUB_RUN_ID")),
    maximumAttempt: Number(required("GITHUB_RUN_ATTEMPT")),
    buildRunId: Number(required("BUILD_RUN_ID")),
    buildAttempt: Number(required("BUILD_ATTEMPT")),
  }
  process.stdout.write(JSON.stringify(await publishHistory(process.cwd(), required("BENCH_INPUT"), context)) + "\n")
}
