// @vitest-environment node
import { expect, test } from "vitest"
import { createHash } from "node:crypto"
import { mkdtemp, readFile, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve } from "node:path"
import { comparisonSeriesKey, extractMetrics } from "./compare"
import { appendHistory, compactRun, historyRecord } from "./history"
import { comparisonFixture } from "./test-fixtures"

const digest = (value: string) => createHash("sha256").update(value).digest("hex")
const expected = { repository: "owner/repo", sourceSha: "a".repeat(40), runId: 17, maximumAttempt: 2 }
const envelope = (raw: string | null, attempt = 1, status = "passed") => ({
  schemaVersion: 1,
  repository: "owner/repo",
  sourceSha: expected.sourceSha,
  measurementRunId: 17,
  measurementAttempt: attempt,
  buildRunId: 16,
  buildAttempt: 1,
  status,
  resultSha256: raw === null ? null : digest(raw),
  artifactRetentionDays: 30,
})
const record = (source = "a", id = 17, status = "passed", attempt = 1) => {
  const run = comparisonFixture()
  run.sourceSha = source.repeat(40)
  run.status = status
  const raw = JSON.stringify(run)
  return historyRecord({ ...envelope(raw, attempt, status), sourceSha: run.sourceSha, measurementRunId: id }, raw, {
    ...expected,
    sourceSha: run.sourceSha,
    runId: id,
  })
}
const ancestry = async (older: string, newer: string) => older[0] <= newer[0]

test("compaction preserves metric values/counts and comparison identity, with bounded histograms", () => {
  const run = { ...comparisonFixture(), browser: { raw: { trace: "huge" } } }
  Object.assign(run.pipeline.publication_to_raw_event_live_ms, { values: [0, 1, 2, 4, -1, null] })
  const compact = compactRun(run)
  expect(extractMetrics(compact.run)).toEqual(extractMetrics(run))
  expect(comparisonSeriesKey(compact.run)).toBe(comparisonSeriesKey(run))
  expect(compact.distributions).toMatchObject({
    "pipeline.publication_to_raw_event_live_ms.values": {
      samples: 6,
      invalid: 2,
      bins: { zero: 1, "0": 1, "1": 1, "2": 1 },
    },
  })
  expect(JSON.stringify(compact.run)).not.toContain('"values"')
  expect(JSON.stringify(compact.run)).not.toContain('"trace"')
})

test("setup failures and invalid result JSON are retained without fabricated metric values", () => {
  const missing = historyRecord(envelope(null, 1, "incomplete"), null, expected)
  expect(missing).toMatchObject({ status: "incomplete", run: null, seriesKey: null, referenceEligible: false })
  const malformed = "{bad"
  const invalid = historyRecord(envelope(malformed, 1, "incomplete"), malformed, expected)
  expect(invalid.reportError).toContain("Invalid result JSON")
  expect(invalid.rawResultSha256).toBe(digest(malformed))
  expect(invalid.run).toBeNull()
})

test.each(["source", "run", "attempt", "checksum", "dirty"])("invalid %s provenance is rejected", (kind) => {
  const run = comparisonFixture()
  if (kind === "dirty") run.sourceStatus = " M file"
  const raw = JSON.stringify(run)
  const attempt = envelope(raw)
  if (kind === "source") attempt.sourceSha = "b".repeat(40)
  if (kind === "run") attempt.measurementRunId = 18
  if (kind === "attempt") attempt.measurementAttempt = 3
  if (kind === "checksum") attempt.resultSha256 = "0".repeat(64)
  expect(() => historyRecord(attempt, raw, expected)).toThrow(/provenance|checksum|checkout/)
})

test("an append is immutable and an identical retry is idempotent", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "benchmark-history-"))
  const first = record()
  expect(await appendHistory(directory, first, ancestry)).toMatchObject({ alreadyPublished: false })
  expect(await appendHistory(directory, first, ancestry)).toMatchObject({ alreadyPublished: true })
  await expect(appendHistory(directory, { ...first, status: "failed" }, ancestry)).rejects.toThrow("Immutable")
  const index = JSON.parse(await readFile(resolve(directory, "index.json"), "utf8"))
  expect(index.entries).toHaveLength(1)
})

test("source ancestry preserves latest across out-of-order completions and keeps failed newer results", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "benchmark-history-order-"))
  const first = record("a", 17),
    newest = record("c", 19),
    older = record("b", 18),
    failed = record("d", 20, "failed")
  for (const run of [first, newest, older, failed]) await appendHistory(directory, run, ancestry)
  const index = JSON.parse(await readFile(resolve(directory, "index.json"), "utf8"))
  expect(index.latest).toBe(failed.id)
  expect(index.entries).toHaveLength(4)
  expect(index.anchors[first.seriesKey!]).toBe(first.id)
  const comparisons = JSON.parse(await readFile(resolve(directory, "runs", `${older.id}.comparison.json`), "utf8"))
  expect(comparisons.rollingReference.baseline.sourceSha).toBe(first.sourceSha)
  const failedComparison = JSON.parse(
    await readFile(resolve(directory, "runs", `${failed.id}.comparison.json`), "utf8"),
  )
  expect(failedComparison.rollingReference.status).toBe("candidate-failed")
})

test("a partial append is recoverable and a new resource configuration starts its own series", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "benchmark-history-recovery-"))
  const first = record()
  const path = resolve(directory, "runs", first.sourceSha)
  await mkdir(path, { recursive: true })
  await writeFile(resolve(directory, "runs", `${first.id}.json`), JSON.stringify(first, null, 2) + "\n")
  await appendHistory(directory, first, ancestry)
  const run = comparisonFixture()
  run.sourceSha = "b".repeat(40)
  run.containerConfiguration.Memory *= 2
  const raw = JSON.stringify(run)
  const different = historyRecord({ ...envelope(raw), sourceSha: run.sourceSha, measurementRunId: 18 }, raw, {
    ...expected,
    sourceSha: run.sourceSha,
    runId: 18,
  })
  await appendHistory(directory, different, ancestry)
  const comparisons = JSON.parse(await readFile(resolve(directory, "runs", `${different.id}.comparison.json`), "utf8"))
  expect(comparisons).toEqual({})
  expect(different.seriesKey).not.toBe(first.seriesKey)
})

test("reviewed reference selection stays fixed and rejects failed measurements", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "benchmark-approved-reference-"))
  const approved = record("a", 17),
    recent = record("b", 18),
    candidate = record("c", 19)
  await appendHistory(directory, approved, ancestry)
  await appendHistory(directory, recent, ancestry)
  const policy = {
    schemaVersion: 1,
    references: {
      [approved.seriesKey!]: { recordId: approved.id, label: "release-v0.2" },
    },
  }
  await writeFile(resolve(directory, "references.json"), JSON.stringify(policy))
  await appendHistory(directory, candidate, ancestry)
  const comparison = JSON.parse(await readFile(resolve(directory, "runs", `${candidate.id}.comparison.json`), "utf8"))
  expect(comparison.rollingReference.baseline.sourceSha).toBe(recent.sourceSha)
  expect(comparison.approvedReference.recordId).toBe(approved.id)
  expect(comparison.approvedReference.comparison.baseline.sourceSha).toBe(approved.sourceSha)
  const failed = record("d", 20, "failed")
  await appendHistory(directory, failed, ancestry)
  policy.references[approved.seriesKey!].recordId = failed.id
  await writeFile(resolve(directory, "references.json"), JSON.stringify(policy))
  await expect(appendHistory(directory, record("e", 21), ancestry)).rejects.toThrow("valid compatible measurement")
})
