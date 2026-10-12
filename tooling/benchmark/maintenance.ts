import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { Surreal } from "surrealdb"
import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { isDeepStrictEqual } from "node:util"
import { extractId } from "../../src/types/surreal-records"
import { idFingerprint, validateReturnedRows } from "./queries"

type Backup = {
  version: number
  tasks: Record<string, unknown>[]
  events: Record<string, unknown>[]
  workers: Record<string, unknown>[]
}
export async function maintenanceDeadline<T>(operation: Promise<T>, milliseconds: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} deadline exceeded`)), milliseconds)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
export function validateBackup(backup: Backup, history: number, live: number) {
  assert.equal(backup.version, 1)
  assert(
    Array.isArray(backup.tasks) && Array.isArray(backup.events) && Array.isArray(backup.workers),
    "Invalid backup tables",
  )
  assert.equal(backup.tasks.length, history + live, "Backup task count differs")
  validateReturnedRows(backup.tasks, "tasks.all", history, live)
  const expected = [
    ...Array.from({ length: history }, (_, i) => `history-${i}`),
    ...Array.from({ length: live }, (_, i) => `bench-${i}`),
  ]
  assert.equal(
    idFingerprint(backup.tasks.map((task) => extractId(task.id))),
    idFingerprint(expected),
    "Backup task identity differs",
  )
  const taskEvents = backup.events.filter(
    (event) => String(event.task_id).startsWith("bench-") || String(event.task_id).startsWith("history-"),
  )
  assert.equal(taskEvents.length, (history + live) * 4, "Backup task-event count differs")
  const workerEvents = backup.events.filter((event) => !taskEvents.includes(event))
  assert(
    workerEvents.every(
      (event) =>
        event.event_type === "worker-heartbeat" &&
        event.hostname === "benchmark-probe" &&
        JSON.parse(String(event.data)).bench_probe === true,
    ),
    "Unexpected non-task event in backup",
  )
  const sequences = backup.events
    .filter((event) => String(event.task_id).startsWith("bench-"))
    .map((event) => JSON.parse(String(event.data)).bench_sequence)
    .sort((a, b) => a - b)
  assert.deepEqual(
    sequences,
    Array.from({ length: live * 4 }, (_, i) => i),
    "Backup raw event coverage differs",
  )
  const historical = backup.events
    .filter((event) => String(event.task_id).startsWith("history-"))
    .map((event) => extractId(event.id))
  assert.equal(
    idFingerprint(historical),
    idFingerprint(
      Array.from({ length: history }, (_, i) =>
        Array.from({ length: 4 }, (_, phase) => `history-${i}-${phase}`),
      ).flat(),
    ),
    "Historical event identity differs",
  )
  return { tasks: backup.tasks.length, events: backup.events.length, workers: backup.workers.length }
}
export function validateRestoredPayloads(original: Backup, restored: Backup) {
  const byId = (rows: Record<string, unknown>[]) => new Map(rows.map((row) => [String(row.id), row]))
  const tasks = byId(restored.tasks),
    events = byId(restored.events)
  const compare = (actual: unknown, row: Record<string, unknown>, kind: string) => {
    if (isDeepStrictEqual(actual, row)) return
    const fields = Object.keys(row).filter(
      (key) => !isDeepStrictEqual((actual as Record<string, unknown> | undefined)?.[key], row[key]),
    )
    throw new Error(
      `Restored ${kind} payload differs: ${String(row.id)}; fields: ${fields.slice(0, 12).join(", ") || "unexpected fields"}`,
    )
  }
  for (const row of original.tasks) compare(tasks.get(String(row.id)), row, "task")
  // The readiness worker can receive a new heartbeat while pollers run. Task
  // history has no concurrent publisher during maintenance and must be exact.
  for (const row of original.events.filter(
    (event) => String(event.task_id).startsWith("bench-") || String(event.task_id).startsWith("history-"),
  ))
    compare(events.get(String(row.id)), row, "raw event")
}

export async function benchmarkMaintenance(
  url: string,
  history: number,
  live: number,
  storage: () => Promise<unknown>,
  output: string,
) {
  const cases: Record<string, unknown>[] = []
  const errors: string[] = []
  const db = new Surreal()
  const request = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(url + path, { ...init, signal: AbortSignal.timeout(120_000) })
    assert(response.ok, `${path}: HTTP ${response.status}`)
    return response
  }
  const measured = async <T>(name: string, operation: () => Promise<T>) => {
    const start = performance.now()
    try {
      const result = await operation()
      cases.push({ name, status: "passed", durationMs: performance.now() - start })
      return result
    } catch (error) {
      cases.push({ name, status: "failed", durationMs: performance.now() - start, error: String(error) })
      throw error
    }
  }
  let exportBytes: number | null = null
  let exportSha256: string | null = null
  let before: unknown = null,
    afterCleanup: unknown = null,
    afterRestore: unknown = null
  const relations = async (retainedHistory: number) => {
    const [workflows, edges] = await maintenanceDeadline(
      db
        .query<[Record<string, unknown>[], Record<string, unknown>[]]>(
          "SELECT * FROM workflow; SELECT `in`, out FROM workflow_task;",
        )
        .collect(),
      120_000,
      "Maintenance workflow query",
    )
    assert.equal(workflows.length, Math.ceil(retainedHistory / 4) + Math.ceil(live / 4), "Unexpected workflow count")
    validateReturnedRows(workflows, "workflows.all", retainedHistory, live)
    const expectedEdges = [
      ...Array.from({ length: retainedHistory }, (_, index) => `history-${index - (index % 4)}:history-${index}`),
      ...Array.from({ length: live }, (_, index) => `bench-${index - (index % 4)}:bench-${index}`),
    ]
    assert.equal(
      idFingerprint(edges.map((edge) => `${extractId(edge.in)}:${extractId(edge.out)}`)),
      idFingerprint(expectedEdges),
      "Workflow membership differs after maintenance",
    )
    for (const row of workflows) {
      const id = extractId(row.id),
        historical = id.startsWith("history-"),
        index = Number(id.split("-")[1])
      const count = Math.min(4, (historical ? retainedHistory : live) - index)
      const failures = historical
        ? Array.from({ length: count }, (_, offset) => (index + offset) % 10 === 0).filter(Boolean).length
        : 0
      assert.equal(row.task_count, count)
      assert.equal(row.failure_count, failures)
      assert.equal(row.aggregate_state, failures ? "FAILURE" : "SUCCESS")
    }
  }
  try {
    await maintenanceDeadline(
      db.connect(`${url.replace(/^http/, "ws")}/surreal/rpc`, {
        namespace: "celery_insights",
        database: "main",
        reconnect: false,
      }),
      15_000,
      "Maintenance connection",
    )
    await maintenanceDeadline(
      db.signin({ namespace: "celery_insights", database: "main", username: "viewer", password: "viewer" }),
      15_000,
      "Maintenance authentication",
    )
    before = await storage()
    const raw = await measured("backup.export", async () => (await request("/api/settings/export")).text())
    exportBytes = Buffer.byteLength(raw)
    exportSha256 = createHash("sha256").update(raw).digest("hex")
    await writeFile(resolve(output, "maintenance-backup.json"), raw, { flag: "wx" })
    const backup = JSON.parse(raw) as Backup
    validateBackup(backup, history, live)
    for (let cycle = 1; cycle <= 2; cycle++) {
      const settings = await request("/api/settings/retention", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cleanup_interval_seconds: 86400,
          task_max_count: live,
          task_retention_hours: null,
          dead_worker_retention_hours: null,
        }),
      })
      assert.equal((await settings.json()).settings.task_max_count, live)
      await measured(`retention.cleanup-${cycle}`, async () => {
        const result = await (await request("/api/settings/cleanup", { method: "POST" })).json()
        assert.equal(result.success, true)
      })
      const retained = JSON.parse(await (await request("/api/settings/export")).text()) as Backup
      validateBackup(retained, 0, live)
      await relations(0)
      afterCleanup = await storage()
      await measured(`backup.import-${cycle}`, async () => {
        const form = new FormData()
        form.set("file", new File([raw], "benchmark-backup.json", { type: "application/json" }))
        const response = await (await request("/api/settings/import", { method: "POST", body: form })).json()
        assert.equal(response.success, true, `Backup import failed: ${JSON.stringify(response)}`)
      })
      const restored = JSON.parse(await (await request("/api/settings/export")).text()) as Backup
      await writeFile(resolve(output, `maintenance-restored-${cycle}.json`), JSON.stringify(restored), { flag: "wx" })
      validateBackup(restored, history, live)
      validateRestoredPayloads(backup, restored)
      await relations(history)
      afterRestore = await storage()
    }
    // Keep restored data intact for the final persisted-data validator and shutdown.
    await request("/api/settings/retention", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cleanup_interval_seconds: 86400,
        task_max_count: null,
        task_retention_hours: null,
        dead_worker_retention_hours: null,
      }),
    })
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
  } finally {
    try {
      await maintenanceDeadline(db.close(), 5_000, "Maintenance connection close")
    } catch (error) {
      errors.push(String(error))
    }
  }
  return {
    status: errors.length ? "failed" : "passed",
    cases,
    exportBytes,
    exportSha256,
    storageBefore: before,
    storageAfterCleanup: afterCleanup,
    storageAfterRestore: afterRestore,
    errors,
    limitations: [
      "Two count-based retention/JSON export/import cycles after ingestion. Background pollers remain active; no concurrent new event publication or replay claim.",
      "Allocation/file checkpoints measure observed space after deletion/refill, not forced compaction or filesystem reclamation.",
    ],
  }
}
