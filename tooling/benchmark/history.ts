import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { compareRuns, comparisonMarkdown, comparisonSeriesKey, extractMetrics } from "./compare"
import { trendSvg } from "./trends"

type ObjectValue = Record<string, unknown>
const object = (value: unknown): ObjectValue =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as ObjectValue) : {}
const hash = (value: string) => createHash("sha256").update(value).digest("hex")
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n"
const sha = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{40}$/.test(value)
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0
const recordId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{40}\/\d+-\d+$/.test(value)

export function compactRun(run: unknown) {
  const distributions: ObjectValue = {}
  const truncations: ObjectValue = {}
  const walk = (value: unknown, path: string): unknown => {
    if (typeof value === "string" && value.length > 2000) {
      truncations[path] = { characters: value.length, sha256: hash(value) }
      return value.slice(0, 2000)
    }
    if (Array.isArray(value)) {
      if (path.endsWith(".values")) {
        const bins: Record<string, number> = {}
        let invalid = 0
        for (const sample of value) {
          if (typeof sample !== "number" || !Number.isFinite(sample) || sample < 0) invalid++
          else {
            const bin = sample === 0 ? "zero" : String(Math.floor(Math.log2(sample)))
            bins[bin] = (bins[bin] ?? 0) + 1
          }
        }
        distributions[path] = { samples: value.length, invalid, bins, unit: "ms", bounds: "[2^k, 2^(k+1))" }
        return undefined
      }
      const limit = path.endsWith(".cases") || path.endsWith(".samplesMs") ? value.length : 20
      if (value.length > limit) truncations[path] = { items: value.length, sha256: hash(JSON.stringify(value)) }
      return value.slice(0, limit).map((item, index) => walk(item, `${path}.${index}`))
    }
    if (value !== null && typeof value === "object") {
      const result: ObjectValue = {}
      for (const [key, item] of Object.entries(object(value))) {
        if (["raw", "query", "plan", "socketRequests", "socketTraffic", "before", "after", "batches"].includes(key))
          continue
        if (key === "files" && path !== "harness") continue
        if (key === "samples" && Array.isArray(item)) continue
        const next = walk(item, path ? `${path}.${key}` : key)
        if (next !== undefined) result[key] = next
      }
      return result
    }
    return value
  }
  const compact = walk(run, "")
  for (const section of ["requests", "concurrentRequests"]) {
    const requestSamples = object(object(run)[section]).samples
    if (Array.isArray(requestSamples)) {
      for (const metric of ["responseMs", "scheduledToCompleteMs", "scheduleLagMs", "headersMs"])
        walk(
          requestSamples.map((sample) => object(sample)[metric]),
          `${section}.allAttempts.${metric}.values`,
        )
    }
  }
  if (JSON.stringify(extractMetrics(run)) !== JSON.stringify(extractMetrics(compact)))
    throw new Error("Compaction changed metric values or sample counts")
  if (comparisonSeriesKey(run) !== comparisonSeriesKey(compact))
    throw new Error("Compaction changed the comparison series")
  return { run: compact, distributions, truncations }
}

export type HistoryRecord = ReturnType<typeof historyRecord>
export function historyRecord(
  envelope: unknown,
  rawResult: string | null,
  expected: { repository: string; sourceSha: string; runId: number; maximumAttempt: number },
) {
  const attempt = object(envelope)
  if (
    attempt.schemaVersion !== 1 ||
    attempt.repository !== expected.repository ||
    attempt.sourceSha !== expected.sourceSha ||
    !sha(attempt.sourceSha) ||
    attempt.measurementRunId !== expected.runId ||
    !positive(attempt.measurementRunId) ||
    !positive(attempt.measurementAttempt) ||
    attempt.measurementAttempt > expected.maximumAttempt ||
    !positive(attempt.buildRunId) ||
    !positive(attempt.buildAttempt) ||
    !["passed", "failed", "incomplete", "inconclusive"].includes(String(attempt.status))
  )
    throw new Error("Attempt provenance does not match the trusted workflow context")
  let result: unknown = null
  let reportError: string | null = typeof attempt.reportError === "string" ? attempt.reportError : null
  if (rawResult !== null) {
    try {
      result = JSON.parse(rawResult)
    } catch {
      reportError = "Invalid result JSON; raw evidence retained"
    }
    if (hash(rawResult) !== attempt.resultSha256) throw new Error("Result checksum does not match the attempt")
    if (result && (object(result).sourceSha !== attempt.sourceSha || object(result).sourceStatus !== ""))
      throw new Error("Result must describe the clean, exact source checkout")
  } else if (attempt.resultSha256 !== null) {
    reportError = reportError ?? "Result file is missing; cannot validate its recorded checksum"
  }
  const compact = compactRun(result)
  const status = result ? object(result).status : "incomplete"
  if (result && status !== attempt.status) throw new Error("Attempt/result outcome mismatch")
  const id = `${attempt.sourceSha}/${attempt.measurementRunId}-${attempt.measurementAttempt}`
  const valid = result !== null && compareRuns(result, result).status === "report-only"
  return {
    historySchemaVersion: 1,
    id,
    attempt,
    sourceSha: attempt.sourceSha,
    status,
    reportError,
    rawResultSha256: rawResult === null ? null : hash(rawResult),
    workflowUrl: `https://github.com/${expected.repository}/actions/runs/${attempt.measurementRunId}`,
    referenceEligible: valid,
    seriesKey: result ? comparisonSeriesKey(result) : null,
    ...compact,
  }
}

type Entry = { id: string; sourceSha: string; status: unknown; seriesKey: string | null; referenceEligible: boolean }
type Index = { schemaVersion: 1; latest: string | null; entries: Entry[]; anchors: Record<string, string> }
type Ancestor = (older: string, newer: string) => Promise<boolean>
const emptyIndex = (): Index => ({ schemaVersion: 1, latest: null, entries: [], anchors: {} })
async function optionalJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, "utf8"))
  } catch (error) {
    if (object(error).code === "ENOENT") return null
    throw error
  }
}

export async function appendHistory(
  directory: string,
  record: HistoryRecord,
  ancestor: Ancestor,
  publisher?: { sourceSha: string; files: Record<string, string> },
) {
  if (!recordId(record.id)) throw new Error("Invalid history record id")
  const previous = await optionalJson(resolve(directory, "index.json"))
  const index = (previous ?? emptyIndex()) as Index
  if (
    index.schemaVersion !== 1 ||
    !Array.isArray(index.entries) ||
    index.anchors === null ||
    typeof index.anchors !== "object" ||
    Array.isArray(index.anchors)
  )
    throw new Error("Invalid index")
  for (const entry of index.entries) {
    if (!recordId(entry.id) || !sha(entry.sourceSha)) throw new Error("Invalid indexed source/id")
  }
  const path = resolve(directory, "runs", `${record.id}.json`)
  await mkdir(resolve(directory, "runs", record.sourceSha), { recursive: true })
  const existing = await optionalJson(path)
  if (existing !== null) {
    if (json(existing) !== json(record))
      throw new Error("Immutable history record already exists with different content")
    if (index.entries.some((entry) => entry.id === record.id)) {
      if ((await optionalJson(path.replace(/\.json$/, ".comparison.json"))) === null)
        throw new Error("Indexed publication has no comparison")
      await readFile(path.replace(/\.json$/, ".md"), "utf8")
      return { id: record.id, alreadyPublished: true }
    }
  }
  const load = async (id: string) => {
    if (!recordId(id)) throw new Error("Invalid reference id")
    return object(await optionalJson(resolve(directory, "runs", `${id}.json`))) as HistoryRecord
  }
  const newer = async (old: Entry, candidate: Entry) => {
    if (old.sourceSha !== candidate.sourceSha) return ancestor(old.sourceSha, candidate.sourceSha)
    const [oldRun, oldAttempt] = old.id.split("/")[1].split("-").map(Number)
    const [run, attempt] = candidate.id.split("/")[1].split("-").map(Number)
    return run > oldRun || (run === oldRun && attempt > oldAttempt)
  }
  let reference: Entry | null = null
  for (const entry of index.entries) {
    if (
      !entry.referenceEligible ||
      entry.seriesKey !== record.seriesKey ||
      (entry.sourceSha === record.sourceSha && !(await newer(entry, record))) ||
      !(await ancestor(entry.sourceSha, record.sourceSha))
    )
      continue
    if (reference === null || (await newer(reference, entry))) reference = entry
  }
  const comparisons: Record<string, unknown> = {}
  if (publisher) comparisons.publisher = publisher
  const markdown: string[] = [
    "# Benchmark history",
    "",
    `Outcome: **${String(record.status)}**.`,
    "",
    `[Workflow evidence](${record.workflowUrl})`,
    "",
  ]
  if (reference) {
    const baseline = await load(reference.id)
    comparisons.rollingReference = compareRuns(baseline.run, record.run)
    markdown.push("## Recent valid reference", "", comparisonMarkdown(compareRuns(baseline.run, record.run)))
  } else markdown.push("No earlier compatible valid reference is available.", "")
  const anchorId = record.seriesKey === null ? null : index.anchors[record.seriesKey]
  if (anchorId) {
    const anchor = await load(anchorId)
    if (await ancestor(anchor.sourceSha, record.sourceSha)) {
      comparisons.calibrationAnchor = compareRuns(anchor.run, record.run)
      markdown.push("## Fixed calibration anchor", "", comparisonMarkdown(compareRuns(anchor.run, record.run)))
    }
  }
  const policy = object(await optionalJson(resolve(directory, "references.json")))
  if (
    Object.keys(policy).length &&
    (policy.schemaVersion !== 1 ||
      !policy.references ||
      typeof policy.references !== "object" ||
      Array.isArray(policy.references))
  )
    throw new Error("Invalid approved-reference policy")
  for (const [series, selection] of Object.entries(object(policy.references))) {
    const selected = object(selection)
    if (
      !/^[0-9a-f]{64}$/.test(series) ||
      !recordId(selected.recordId) ||
      typeof selected.label !== "string" ||
      !/^[A-Za-z0-9 ._/-]{1,100}$/.test(selected.label)
    )
      throw new Error("Invalid approved-reference selection")
    if (series !== record.seriesKey) continue
    const approved = await load(selected.recordId)
    if (
      !approved ||
      approved.id !== selected.recordId ||
      !approved.referenceEligible ||
      approved.seriesKey !== series ||
      compareRuns(approved.run, approved.run).status !== "report-only"
    )
      throw new Error("Approved reference must identify a valid compatible measurement")
    const eligible = await ancestor(approved.sourceSha, record.sourceSha)
    comparisons.approvedReference = {
      recordId: selected.recordId,
      label: selected.label,
      comparison: eligible ? compareRuns(approved.run, record.run) : null,
      reason: eligible ? null : "Approved source is not an ancestor of this attempt",
    }
    markdown.push(
      "## Approved reference",
      "",
      `${selected.label}: ${selected.recordId}`,
      "",
      eligible
        ? comparisonMarkdown(compareRuns(approved.run, record.run))
        : "Approved source is not an ancestor; no timing comparison.",
      "",
    )
  }
  markdown.push(
    "Recent references and calibration anchors are not approved releases. Approved references require an explicit reviewed selection. Timing flags remain report-only. Raw artifacts expire; compact evidence remains in Git.",
    "",
  )
  // Write all immutable outputs before updating generated pointers. Recover a partial
  // publication by reusing identical files; conflicting evidence is never overwritten.
  const immutable = async (file: string, value: string) => {
    try {
      await writeFile(file, value, { flag: "wx" })
    } catch (error) {
      if (object(error).code !== "EEXIST" || (await readFile(file, "utf8")) !== value) throw error
    }
  }
  await immutable(path, json(record))
  await immutable(path.replace(/\.json$/, ".comparison.json"), json(comparisons))
  await immutable(path.replace(/\.json$/, ".md"), markdown.join("\n"))
  const entry: Entry = {
    id: record.id,
    sourceSha: record.sourceSha,
    status: record.status,
    seriesKey: record.seriesKey,
    referenceEligible: record.referenceEligible,
  }
  index.entries.push(entry)
  if (record.referenceEligible && record.seriesKey && !anchorId) index.anchors[record.seriesKey] = record.id
  const current = index.entries.find((item) => item.id === index.latest)
  if (!current || (await newer(current, entry))) index.latest = entry.id
  await writeFile(resolve(directory, "index.json"), json(index))
  await writeFile(
    resolve(directory, "trends.svg"),
    trendSvg(await Promise.all(index.entries.map((item) => load(item.id)))),
  )
  const latest = index.entries.find((item) => item.id === index.latest)!
  await writeFile(
    resolve(directory, "README.md"),
    [
      "# Benchmark results",
      "",
      `Latest source: ${latest.sourceSha}. Outcome: **${String(latest.status)}**.`,
      "",
      `[Latest report](runs/${latest.id}.md)`,
      "",
      "![Benchmark trends](trends.svg)",
      "",
      ...index.entries.map((item) => `- [${item.id}](runs/${item.id}.md): ${String(item.status)}`),
      "",
    ].join("\n"),
  )
  return { id: record.id, alreadyPublished: false }
}
