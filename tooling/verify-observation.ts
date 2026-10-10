import { ObservationRpc } from "../runtime/observation/rpc"
import { initializeAuthentication } from "../runtime/security/http"
/** Native Bun application API acceptance against a disposable observation database. */
import { scopedDatabase, intersectScopes } from "../runtime/security/read-scope"
import { SearchIndexes } from "../runtime/search-indexes"
import { buildRead, operations } from "../runtime/observation/queries"
import assert from "node:assert/strict"
import { createServer } from "node:net"
import { randomBytes } from "node:crypto"
import { ObservationApi } from "../runtime/observation-api"
import { validateConfig } from "../runtime/config"
import { CORE_SCHEMA } from "../runtime/surreal-schema"
import { Surreal, Table } from "surrealdb"
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
    "CREATE task:sample SET type = 'sample', state = 'SUCCESS', workflow_id = 'sample', runtime = 0.2, last_updated = time::now(), result = 'private-result', kwargs = '{\"channel\":\"north team\"}'; CREATE event:sample SET task_id = 'sample', event_type = 'task-succeeded', timestamp = time::now(); CREATE worker:sample SET status = 'online', last_updated = time::now(); CREATE workflow:sample SET root_task_id = 'sample', aggregate_state = 'SUCCESS', task_count = 1, last_updated = time::now(); RELATE workflow:sample->workflow_task:sample->task:sample;",
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
  const indexes = new SearchIndexes(root)
  await indexes.start(true)
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
  for (const table of ["task", "workflow"] as const) {
    const read = buildRead({
      operation: "explorer",
      table,
      query: 'channel="north team"',
      from: "2000-01-01T00:00:00Z",
      to: "2100-01-01T00:00:00Z",
    })
    const result = await root.query(read.sql, read.bindings).collect()
    // Tasks have six result sets; workflows have five, after any LET prelude.
    const matching = result.at(table === "task" ? -6 : -5) as unknown[]
    assert.equal(matching.length, 1, `${table} typed kwargs explorer`)
    const projection = scopedDatabase(root, { deny_fields: ["task.input.read"] })
    const denied = await projection.query(read.sql, read.bindings).collect()
    const deniedCsv = await api.withDatabase(projection).exportCsv({
      kind: "explorer",
      mode: table === "task" ? "tasks" : "workflows",
      query: 'channel="north team"',
      from: "2000-01-01T00:00:00Z",
      to: "2100-01-01T00:00:00Z",
    })
    assert.equal((await deniedCsv.text()).includes('"sample"'), false)

    assert.equal(
      (denied.at(table === "task" ? -6 : -5) as unknown[]).length,
      0,
      `${table} kwargs search cannot match denied inputs`,
    )
  }
  const noTasks = scopedDatabase(root, { task_ids: [], deny_fields: [] })
  const indexedRead = buildRead({
    operation: "explorer",
    query: 'channel="north team"',
    from: "2000-01-01T00:00:00Z",
    to: "2100-01-01T00:00:00Z",
  })
  const hiddenMatches = await noTasks.query(indexedRead.sql, indexedRead.bindings).collect()
  assert.deepEqual(hiddenMatches.slice(indexedRead.resultOffset)[0], [])
  const quickSearch = buildRead({ operation: "search", query: 'channel="north team"' })
  assert.equal(
    ((await root.query(quickSearch.sql, quickSearch.bindings).collect())[quickSearch.resultOffset] as unknown[]).length,
    1,
  )
  await indexes.stop()
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
  // Apply visibility before search, aggregation, export, and record lookups.
  await root.query(
    "CREATE task:hidden SET type = 'private.type', state = 'SUCCESS', workflow_id = 'hidden', parent_id = 'sample', args = 'hidden-args', result = 'hidden-result', exception = 'hidden-failure', last_updated = time::now(); CREATE event:hidden SET task_id = 'hidden', event_type = 'task-succeeded', timestamp = time::now();",
  )
  const scope = { task_ids: ["sample"], deny_fields: ["task.result.read" as const] }
  const scoped = scopedDatabase(root, scope)
  const [visible] = await scoped.query<[Array<Record<string, unknown>>]>("SELECT * FROM task")
  assert.equal(visible.length, 1)
  assert.equal(String(visible[0].id), "task:sample")
  for (const field of ["result", "parent_id", "root_id", "workflow_id"]) assert.equal(visible[0][field], undefined)
  assert.deepEqual(visible[0].children, [])
  const [hidden] = await scoped.query<[unknown[]]>("SELECT * FROM type::record('task', $taskId)", { taskId: "hidden" })
  assert.deepEqual(hidden, [])
  const [counts, events, workflows, search] = await scoped.query<[unknown[], unknown[], unknown[], unknown[]]>(
    "SELECT count() AS count FROM task GROUP ALL; SELECT * FROM event; SELECT * FROM workflow; SELECT * FROM task WHERE string::contains(result ?? '', 'private-result');",
  )
  assert.deepEqual(counts, [{ count: 1 }])
  assert.equal(events.length, 1)
  assert.deepEqual(workflows, [])
  assert.deepEqual(search, [])
  const view = api.withDatabase(scoped)
  assert.deepEqual(await view.counts(), { tasks: 1, events: 1, workers: 1 })
  const scopedBackup = await view.handle(
    new Request("http://localhost/api/settings/export"),
    "/api/settings/export",
    false,
  )
  assert.doesNotMatch(await scopedBackup!.text(), /hidden|private-result/)
  assert.doesNotMatch(
    await (
      await view.exportCsv({
        kind: "explorer",
        mode: "tasks",
        from: "2000-01-01T00:00:00Z",
        to: "2100-01-01T00:00:00Z",
      })
    ).text(),
    /hidden|private-result/,
  )
  const denyAll = scopedDatabase(root, intersectScopes(scope, { task_ids: [], deny_fields: [] }))
  assert.deepEqual((await denyAll.query("SELECT * FROM task"))[0], [])
  for (const operation of operations) {
    const read = buildRead({ operation, from: "2000-01-01T00:00:00Z", to: "2100-01-01T00:00:00Z", taskId: "sample" })
    await scoped.query(read.sql, read.bindings)
  }
  await root.query(
    "UPDATE task:sample SET args = 'private-input', kwargs = 'private-kwargs', exception = 'private-failure', traceback = 'private-traceback'; UPDATE worker:sample SET inspect = $inspect;",
    { inspect: JSON.stringify({ private: "private-worker" }) },
  )
  for (const [action, fields] of [
    ["task.input.read", ["args", "kwargs"]],
    ["task.result.read", ["result", "result_truncated"]],
    ["task.failure.read", ["exception", "traceback"]],
    ["worker.inspect.read", ["inspect"]],
  ] as const) {
    const projection = scopedDatabase(root, { deny_fields: [action] })
    const [records] = await projection.query<[Array<Record<string, unknown>>]>(
      `SELECT * FROM ${action === "worker.inspect.read" ? "worker" : "task"}`,
    )
    for (const record of records) for (const field of fields) assert.equal(record[field], undefined)
    const [matches] = await projection.query<[unknown[]]>(
      `SELECT * FROM ${action === "worker.inspect.read" ? "worker" : "task"} WHERE ${fields[0]} != NONE`,
    )
    assert.deepEqual(matches, [])
  }
  const selected = scopedDatabase(root, {
    task_types: ["sample"],
    task_workers: ["sample-worker"],
    worker_hostnames: ["sample"],
    deny_fields: [],
  })
  assert.deepEqual((await selected.query("SELECT * FROM task"))[0], [])
  assert.equal((await selected.query<[unknown[]]>("SELECT * FROM worker"))[0].length, 1)
  const injection = scopedDatabase(root, { task_ids: ["sample'); DELETE task; --"], deny_fields: [] })
  assert.deepEqual((await injection.query("SELECT * FROM task"))[0], [])
  assert.equal(
    (await root.query<[Array<{ count: number }>]>("SELECT count() AS count FROM task GROUP ALL"))[0][0].count,
    2,
  )
  const authentication = initializeAuthentication({
    public_origin: "http://localhost",
    accounts: [{ username: "test", password: "fixture", roles: ["administrator"] }],
  })
  const fixtureServer = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request: Request, server: any) {
      if (server.upgrade(request, { data: {}, headers: { "sec-websocket-protocol": "cbor" } })) return
      return new Response(null, { status: 404 })
    },
    websocket: {
      open(socket: any) {
        socket.data.rpc = new ObservationRpc(
          socket,
          authentication,
          "test",
          root,
          { deny_fields: [] },
          false,
          false,
          100,
        )
      },
      message(socket: any, message: string | Uint8Array) {
        void socket.data.rpc!.receive(message)
      },
      close(socket: any) {
        socket.data.rpc?.stop()
      },
    },
  })
  const browser = new Surreal()
  try {
    await browser.connect(`ws://127.0.0.1:${fixtureServer.port}/api/observation/rpc`, { reconnect: false })
    const [tasks] = await browser.query<[unknown[]]>("observation:read", {
      request: { operation: "list", table: "task" },
    })
    assert.equal(tasks.length, 2)
    const [searchedTasks] = await browser.query<[unknown[]]>("observation:read", {
      request: { operation: "search", query: "private-kwargs" },
    })
    assert.equal(searchedTasks.length, 1, "SDK results omit internal index candidate slots")
    const live = await browser.live(new Table("task"))
    const refresh = await new Promise<unknown>((resolve) => live.subscribe((message) => resolve(message.value)))
    assert.deepEqual(refresh, { __observation_refresh: true })
    await live.kill()
    await assert.rejects(browser.query("SELECT * FROM task").collect())
  } finally {
    await browser.close()
    await fixtureServer.stop(true)
  }
  await root.query("DELETE task:hidden; DELETE event:hidden;")
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
  process.stdout.write(
    "Bun acceptance passed: scoped reads/fields/exports, typed SDK/refreshes, metrics/backup/restore/cleanup\n",
  )
} finally {
  await root.close()
  child.kill()
  await child.exited
}
