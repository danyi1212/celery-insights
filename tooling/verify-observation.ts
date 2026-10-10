/** Native Bun application API acceptance against a disposable observation database. */
import assert from "node:assert/strict"
import { createServer } from "node:net"
import { randomBytes } from "node:crypto"
import { ObservationApi } from "../runtime/observation-api"
import { validateConfig } from "../runtime/config"
import { CORE_SCHEMA } from "../runtime/surreal-schema"
import { Surreal } from "surrealdb"
const binary = process.env.SURREAL_BINARY ?? "surreal"
const version = Bun.spawnSync([binary, "version"])
if (version.exitCode !== 0 || !Buffer.from(version.stdout).toString().includes("3.3.0")) {
  if (process.env.CI) throw new Error("Application acceptance requires pinned SurrealDB 3.3.0\n")
  process.stdout.write("Database acceptance requires SurrealDB 3.3.0\n")
  process.exit(0)
}
const listener = createServer()
await new Promise<void>((resolve) => listener.listen(0, "127.0.0.1", resolve))
const address = listener.address()
assert(address && typeof address !== "string")
const port = address.port
await new Promise<void>((resolve, reject) => listener.close((error) => (error ? reject(error) : resolve())))
const rootPassword = randomBytes(24).toString("base64url")
const child = Bun.spawn(
  [binary, "start", "--bind", `127.0.0.1:${port}`, "--user", "root", "--pass", rootPassword, "memory"],
  { stdout: "ignore", stderr: "inherit" },
)
const url = `http://127.0.0.1:${port}`
const root = new Surreal()
try {
  let ready = false
  const startupDeadline = Date.now() + 30_000
  while (Date.now() < startupDeadline) {
    assert(child.exitCode === null, `Disposable database exited with code ${child.exitCode}`)
    try {
      if ((await fetch(url + "/health", { signal: AbortSignal.timeout(1000) })).ok) {
        ready = true
        break
      }
    } catch {
      /* Fixture not listening yet. */
    }
    await Bun.sleep(50)
  }
  assert(ready, "Disposable database did not start")
  await root.connect(url)
  await root.signin({ username: "root", password: rootPassword })
  await root.query("DEFINE NAMESPACE test; USE NS test; DEFINE DATABASE observation;")
  await root.use({ namespace: "test", database: "observation" })
  await root.query(CORE_SCHEMA)
  await root.query(
    "CREATE task:sample SET type = 'sample', state = 'SUCCESS', execution_observed_at = time::now(), execution_active_at = time::now(), workflow_id = 'sample', runtime = 0.2, last_updated = time::now(), result = 'private-result', kwargs = '{\"channel\":\"north team\"}'; CREATE event:sample SET task_id = 'sample', event_type = 'task-succeeded', timestamp = time::now(); CREATE worker:sample SET status = 'online', last_updated = time::now(); CREATE workflow:sample SET root_task_id = 'sample', aggregate_state = 'SUCCESS', task_count = 1, last_updated = time::now(); RELATE workflow:sample->workflow_task:sample->task:sample;",
  )
  const api = new ObservationApi(root, validateConfig({}), async () => ({
    python_version: "fixture",
    ingestion: { events_ingested_total: 1, flushes_total: 1, buffer_size: 0, queue_size: 0 },
  }))
  assert.deepEqual(await api.counts(), { tasks: 1, events: 1, workers: 1 })
  for (const path of ["/metrics", "/metrics/verbose", "/metrics/system"]) {
    const response = await api.metrics(path)
    const content = await response.text()
    assert.match(
      content,
      path === "/metrics/system" ? /celery_insights_events_ingested_total 1/ : /celery_tasks_total 1/,
    )
    assert.match(
      content,
      path === "/metrics/system" ? /celery_insights_db_tasks_count 1/ : /celery_task_runtime_seconds_sum 0.2/,
    )
  }
  const csv = await api.exportCsv({
    kind: "explorer",
    mode: "tasks",
    from: "2000-01-01T00:00:00Z",
    to: "2100-01-01T00:00:00Z",
    sortField: "state; DELETE task;",
  })
  assert.match(await csv.text(), /private-result/)
  // The Bun migration must preserve main's kwargs search in both export modes.
  for (const mode of ["tasks", "workflows"] as const) {
    for (const [query, matches] of [
      ['channel="north team"', true],
      ['channel="other"', false],
    ] as const) {
      const result = await api.exportCsv({
        kind: "explorer",
        mode,
        query,
        from: "2000-01-01T00:00:00Z",
        to: "2100-01-01T00:00:00Z",
      })
      assert.equal((await result.text()).includes('"sample"'), matches, `${mode} export: ${query}`)
    }
  }
  const backupResponse = await api.handle(
    new Request("http://localhost/api/settings/export"),
    "/api/settings/export",
    false,
  )
  const backup = await backupResponse!.json()
  for (const invalid of [null, [], { version: 2 }, { version: 1, credentials: { password: "unexpected" } }]) {
    assert.equal((await (await api.importBackup(invalid)).json()).success, false)
  }
  assert.equal(
    (
      await (
        await api.importBackup({ version: 1, tasks: [{ id: "unexpected_table:admin" }], events: [], workers: [] })
      ).json()
    ).success,
    false,
  )
  assert.deepEqual(await api.counts(), { tasks: 1, events: 1, workers: 1 })
  assert.equal((await (await api.importBackup(backup)).json()).success, true)
  assert.deepEqual(await api.counts(), { tasks: 1, events: 1, workers: 1 })
  const [restoredWorkflows, restoredEdges] = await root.query<[Array<{ task_count: number }>, unknown[]]>(
    "SELECT * FROM workflow; SELECT * FROM workflow_task;",
  )
  assert.equal(restoredWorkflows[0].task_count, 1)
  assert.equal(restoredEdges.length, 1)
  const update = new Request("http://localhost/api/settings/retention", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      cleanup_interval_seconds: 60,
      task_max_count: 0,
      task_retention_hours: null,
      dead_worker_retention_hours: null,
    }),
  })
  await api.handle(update, "/api/settings/retention", false)
  await api.cleanup()
  assert.deepEqual(await api.counts(), { tasks: 0, events: 0, workers: 1 })
  process.stdout.write("Bun acceptance passed: observation metrics/CSV/backup/restore/cleanup\n")
} finally {
  await root.close()
  child.kill()
  await child.exited
}
