import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { Surreal } from "surrealdb"
import { buildExplorerQuery, type ExplorerFilters } from "../../src/lib/explorer-query"
import { distribution } from "./requests"
import { extractId } from "../../src/types/surreal-records"

type Rows = Record<string, unknown>[]
export function validateReturnedRows(rows: Rows, name: string, history: number, live: number) {
  for (const row of rows) {
    const match = /^(history|bench)-(\d+)$/.exec(extractId(row.id))
    assert(match, "Unexpected fixture record ID")
    const historical = match[1] === "history"
    const index = Number(match[2])
    const size = historical ? history : live
    assert(index < size, "Fixture ID outside manifest")
    const workflow = name.startsWith("workflows.")
    if (workflow) assert.equal(index % 4, 0, "Unexpected workflow root")
    if (name.endsWith(".failure")) {
      assert(historical, "Live fixture cannot fail")
      assert(
        workflow
          ? Array.from({ length: Math.min(4, size - index) }, (_, offset) => index + offset).some(
              (member) => member % 10 === 0,
            )
          : index % 10 === 0,
        "Wrong failure selection",
      )
    }
    if (name.endsWith(".type")) assert(historical && index % 4 === 2, "Wrong type selection")
    if (name.endsWith(".common-search")) assert(historical, "Wrong common search selection")
    if (name.endsWith(".kwargs"))
      assert(
        workflow
          ? Array.from({ length: Math.min(4, size - index) }, (_, offset) => index + offset).some(
              (member) => member % 11 === 7,
            )
          : index % 11 === 7,
        "Wrong kwargs selection",
      )
    if (!workflow) {
      assert.equal(row.state, historical && index % 10 === 0 ? "FAILURE" : "SUCCESS")
      assert.equal(row.type, historical ? `history.work.${index % 4}` : "benchmark.work")
      assert.equal(row.workflow_id, `${match[1]}-${index - (index % 4)}`)
    }
  }
}
export function idFingerprint(ids: string[]) {
  return createHash("sha256")
    .update(JSON.stringify([...ids].sort()))
    .digest("hex")
}
export function expectedHistoryCounts(tasks: number) {
  let failureWorkflows = 0
  for (let root = 0; root < tasks; root += 4) {
    if (
      Array.from({ length: Math.min(4, tasks - root) }, (_, offset) => root + offset).some((index) => index % 10 === 0)
    )
      failureWorkflows++
  }
  return {
    tasks,
    events: tasks * 4,
    workflows: Math.ceil(tasks / 4),
    failures: Math.ceil(tasks / 10),
    failureWorkflows,
  }
}
const countRemainder = (count: number, divisor: number, remainder: number) =>
  count <= remainder ? 0 : Math.floor((count - 1 - remainder) / divisor) + 1
const selectedGroups = (count: number) =>
  new Set(
    Array.from({ length: count }, (_, index) => index)
      .filter((index) => index % 11 === 7)
      .map((index) => index - (index % 4)),
  ).size

export function validateExplorerResponse(
  results: unknown[],
  preludeCount: number,
  mode: "tasks" | "workflows",
  expected: number,
  rowLimit: number,
) {
  const parts = results.slice(preludeCount) as Rows[]
  const rows = parts[0]
  const count = parts[1]?.[0]?.count
  assert.equal(count, expected, "Explorer count differs")
  assert.equal(rows.length, Math.min(rowLimit, expected), "Explorer row limit differs")
  const sum = (values: Rows) => values.reduce((total, row) => total + Number(row.count), 0)
  assert.equal(sum(parts[2]), expected, "State facets differ")
  assert.equal(sum(parts.at(-1)!), expected, "Histogram differs")
  if (mode === "tasks") {
    assert.equal(sum(parts[3]), expected, "Type facets differ")
    assert.equal(sum(parts[4]), expected, "Worker facets differ")
  } else assert.equal(sum(parts[3]), expected, "Root type facets differ")
}

export async function benchmarkQueries(
  url: string,
  history: number,
  liveTasks: number,
  referenceTime: string,
  repetitions: number,
) {
  const db = new Surreal()
  const manifest = expectedHistoryCounts(history)
  const validations: Record<string, unknown> = {}
  const cases: Record<string, unknown>[] = []
  let stage = "connect"
  let activeCase: Record<string, unknown> | null = null
  try {
    await db.connect(url.replace(/^http/, "ws") + "/surreal/rpc")
    await db.signin({ namespace: "celery_insights", database: "main", username: "viewer", password: "viewer" })
    await db.use({ namespace: "celery_insights", database: "main" })
    stage = "fixture-validation"
    const ids = async (table: string) => {
      const [rows] = await db
        .query<[string[]]>(
          `SELECT VALUE record::id(id) FROM ${table} WHERE string::starts_with(record::id(id), 'history-')`,
        )
        .collect()
      return rows
    }
    const expected = {
      task: Array.from({ length: history }, (_, index) => `history-${index}`),
      event: Array.from({ length: history * 4 }, (_, index) => `history-${Math.floor(index / 4)}-${index % 4}`),
      workflow: Array.from({ length: Math.ceil(history / 4) }, (_, index) => `history-${index * 4}`),
      workflow_task: Array.from({ length: history }, (_, index) => `history-${index - (index % 4)}:history-${index}`),
    }
    const validationStart = performance.now()
    for (const [table, names] of Object.entries(expected)) {
      const actual = await ids(table)
      assert.equal(actual.length, names.length, `${table} record count differs`)
      assert.equal(idFingerprint(actual), idFingerprint(names), `${table} record IDs differ`)
      validations[table] = { records: actual.length, idSha256: idFingerprint(actual) }
    }
    const [states] = await db
      .query<[Rows]>(
        "SELECT state,count() AS count FROM task WHERE string::starts_with(record::id(id),'history-') GROUP BY state",
      )
      .collect()
    const stateCounts = Object.fromEntries(states.map((row) => [row.state, row.count]))
    assert.equal(stateCounts.FAILURE ?? 0, manifest.failures)
    assert.equal(stateCounts.SUCCESS ?? 0, history - manifest.failures)
    const validationMs = performance.now() - validationStart
    const time = {
      from: new Date(Date.parse(referenceTime) - 3_600_000).toISOString(),
      to: new Date(Date.now() + 60_000).toISOString(),
      bucketDuration: "1m",
    }
    const base: ExplorerFilters = {
      mode: "tasks",
      query: "",
      states: [],
      types: [],
      workers: [],
      workflowStates: [],
      rootTypes: [],
      sortField: "last_updated",
      sortDirection: "DESC",
    }
    const definitions: [string, Partial<ExplorerFilters>, number, number][] = [
      ["tasks.all", {}, history + liveTasks, 50],
      ["tasks.large-page", {}, history + liveTasks, 200],
      ["tasks.failure", { states: ["FAILURE"] }, manifest.failures, 50],
      ["tasks.type", { types: ["history.work.2"] }, countRemainder(history, 4, 2), 50],
      ["tasks.common-search", { query: "history.work" }, history, 50],
      [
        "tasks.kwargs",
        { query: "organization_id=7" },
        countRemainder(history, 11, 7) + countRemainder(liveTasks, 11, 7),
        50,
      ],
      ["tasks.no-match", { query: "benchmark-missing-token" }, 0, 50],
      ["workflows.all", { mode: "workflows" }, manifest.workflows + Math.ceil(liveTasks / 4), 50],
      ["workflows.failure", { mode: "workflows", workflowStates: ["FAILURE"] }, manifest.failureWorkflows, 50],
      [
        "workflows.kwargs",
        { mode: "workflows", query: "organization_id=7" },
        selectedGroups(history) + selectedGroups(liveTasks),
        50,
      ],
    ]
    for (const [name, filters, total, limit] of definitions) {
      const state = { ...base, ...filters }
      const built = buildExplorerQuery(state, time, limit)
      const samples: number[] = []
      let responseBytes = 0
      activeCase = {
        name,
        status: "running",
        expectedMatches: total,
        rowLimit: limit,
        samplesMs: samples,
        query: { sql: built.sql, bindings: built.bindings },
      }
      cases.push(activeCase)
      stage = "query-warmup"
      // Warmup validates the full production request, not just the row SELECT.
      const warmup = await db.query(built.sql, built.bindings).collect()
      validateExplorerResponse(warmup, built.preludeCount, state.mode, total, limit)
      const verifyRows = (result: unknown[]) =>
        validateReturnedRows(result[built.preludeCount] as Rows, name, history, liveTasks)
      verifyRows(warmup)
      for (let attempt = 0; attempt < repetitions; attempt++) {
        stage = `query-trial-${attempt}`
        const started = performance.now()
        const result = await db.query(built.sql, built.bindings).collect()
        samples.push(performance.now() - started)
        responseBytes = Buffer.byteLength(JSON.stringify(result))
        validateExplorerResponse(result, built.preludeCount, state.mode, total, limit)
        verifyRows(result)
      }
      stage = "query-plan"
      const plan = await db.query(built.rowPlanSql, built.bindings).collect()
      Object.assign(activeCase, {
        status: "passed",
        medianMs: distribution(samples).p50,
        minMs: Math.min(...samples),
        maxMs: Math.max(...samples),
        responseJsonBytes: responseBytes,
        plan,
      })
      console.warn(`Viewer query ${name}: ${samples.length} samples, median ${activeCase.medianMs} ms`)
    }
    return {
      status: "passed",
      manifest,
      validationMs,
      idValidation: validations,
      cases,
      referenceTime,
      limitations: [
        "Warm-cache sequential read latency, not offered query throughput or cold-cache performance.",
        "Initial ID/state validation touches retained records outside timing; read fixture bypasses ingestion.",
        "Median/range across few repetitions; no tail percentile or resource-sizing gate.",
      ],
    }
  } catch (error) {
    if (activeCase) activeCase.status = "failed"
    return {
      status: "failed",
      error: String(error),
      failedOperation: { stage, caseName: activeCase?.name ?? null },
      manifest,
      idValidation: validations,
      cases,
      referenceTime,
      limitations: [
        "Partial successful query samples cannot establish tail latency or successful capacity for this failed run.",
      ],
    }
  } finally {
    await db.close()
  }
}
