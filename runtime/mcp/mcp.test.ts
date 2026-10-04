import { parseConfig } from "../config"
// @vitest-environment node
import { spawn, type ChildProcess } from "node:child_process"
import { createServer } from "node:net"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { Surreal, RecordId } from "surrealdb"
import { CORE_SCHEMA, runSchemaMigration } from "../surreal-schema"
import { createMcpHandler, McpTools } from "./index"
import { Cursors, MAX_RESPONSE_BYTES, type Row, utf8Size } from "./common"
import { outputSchemas } from "./output-schemas"

let databaseProcess: ChildProcess | undefined
let databaseEndpoint: string
const startDatabase = async (): Promise<string> => {
  const port = await new Promise<number>((resolve, reject) => {
    const socket = createServer()
    socket.on("error", reject)
    socket.listen(0, "127.0.0.1", () => {
      const address = socket.address()
      if (!address || typeof address === "string") return reject(new Error("No local port available"))
      socket.close(() => resolve(address.port))
    })
  })
  let failure: Error | undefined
  databaseProcess = spawn(
    "surreal",
    ["start", "--bind", `127.0.0.1:${port}`, "--user", "root", "--pass", "root", "memory"],
    { stdio: "ignore" },
  )
  databaseProcess.on("error", (error) => {
    failure = error
  })
  databaseProcess.on("exit", (code) => {
    failure ??= new Error(`SurrealDB exited with code ${code}`)
  })
  const end = Date.now() + 10_000
  while (Date.now() < end) {
    if (failure) throw new Error("MCP tests require the SurrealDB 3.3+ CLI on PATH", { cause: failure })
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return `ws://127.0.0.1:${port}/rpc`
    } catch {
      /* Starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error("SurrealDB test instance did not become ready")
}

const NOW = Date.parse("2026-10-02T09:05:00Z")
let db: Surreal
let tools: McpTools
const call = async (name: Parameters<McpTools["call"]>[0], args: Row = {}) => {
  const result = await tools.call(name, args)
  outputSchemas[name].parse(result)
  return result
}
const task = async (id: string, overrides: Row = {}) => {
  await db
    .query("UPSERT $id CONTENT $data", {
      id: new RecordId("task", id),
      data: {
        type: "reports.render",
        state: "SUCCESS",
        workflow_id: "root",
        last_updated: new Date(NOW - 60_000),
        first_observed_at: new Date(NOW - 120_000),
        sent_at: new Date(NOW - 120_000),
        ...overrides,
      },
    })
    .collect()
}
const worker = async (hostname: string, data: Row, overrides: Row = {}) => {
  await db
    .query("UPSERT $id CONTENT $data", {
      id: new RecordId("worker", hostname),
      data: {
        status: "online",
        missed_polls: 0,
        last_updated: new Date(NOW),
        inspect: JSON.stringify(data),
        ...overrides,
      },
    })
    .collect()
}
const asRows = (value: unknown) => value as Row[]

describe("MCP tools against SurrealDB", () => {
  beforeAll(async () => {
    db = new Surreal()
    databaseEndpoint = process.env.MCP_TEST_URL ?? (await startDatabase())
    await db.connect(databaseEndpoint, { authentication: { username: "root", password: "root" } })
    await db.use({ namespace: "test", database: "mcp" })
    await db.query(CORE_SCHEMA).collect()
    tools = new McpTools({ db, cursorSecret: "test-secret", mode: () => "live", now: () => NOW })
  }, 30_000)
  beforeEach(async () => {
    await db
      .query(
        "DELETE task; DELETE workflow; DELETE event; DELETE worker; UPSERT workflow:root SET root_task_id = 'root', root_task_type = 'reports.generate', aggregate_state = 'STARTED'",
      )
      .collect()
  })
  afterAll(async () => {
    await db?.close()
    databaseProcess?.kill("SIGTERM")
  })

  it("finds fast completions and preserves errors independently of progress", async () => {
    await task("done", { had_error: true })
    const result = await call("search_workflows", { task_name: "render", has_errors: true, status: "finished" })
    expect(asRows(result.workflows)).toHaveLength(1)
    expect(asRows(result.workflows)[0]).toMatchObject({
      workflow_id: "root",
      status: "finished",
      has_errors: true,
      error_task_count: 1,
      task_counts: { total: 1 },
    })
    expect(asRows(result.workflows)[0].matching_task).toMatchObject({ invoked_at: "2026-10-02T09:03:00.000Z" })
    expect(asRows((await call("search_workflows", { has_errors: false })).workflows)).toEqual([])
  })
  it("migrates existing datetime records repeatedly and serves tools through a viewer connection", async () => {
    await task("root")
    await task("child", { root_id: "root", worker: "celery@A", had_error: true })
    const config = parseConfig({
      SURREALDB_URL: databaseEndpoint,
      SURREALDB_NAMESPACE: "test",
      SURREALDB_DATABASE: "mcp",
    })
    await runSchemaMigration(config)
    await runSchemaMigration(config)
    const [edges] = await db.query<Row[]>("SELECT * FROM workflow_task").collect()
    expect(edges).toHaveLength(2)
    const viewer = new Surreal()
    try {
      await viewer.connect(databaseEndpoint, {
        namespace: "test",
        database: "mcp",
        authentication: {
          username: "observation_reader",
          password: config.surrealdbIngesterPass,
          namespace: "test",
          database: "mcp",
        },
      })
      const readOnly = new McpTools({ db: viewer, cursorSecret: "secret", mode: () => "live", now: () => NOW })
      const result = await readOnly.call("search_workflows", { has_errors: true })
      expect(asRows(result.workflows)).toHaveLength(1)
      expect(asRows(result.workflows)[0]).toMatchObject({ workflow_id: "root", task_counts: { total: 2 } })
    } finally {
      await viewer.close()
    }
  })
  it("requires task name and worker to match the same member", async () => {
    await task("render", { worker: "celery@A" })
    await task("publish", { type: "reports.publish", worker: "celery@B" })
    expect(asRows((await call("search_workflows", { task_name: "render", worker: "B" })).workflows)).toEqual([])
  })
  it("keeps whole-workflow counts separate from matching counts", async () => {
    await task("render")
    await task("publish", { type: "reports.publish", state: "STARTED" })
    const result = await call("search_workflows", { task_name: "render" })
    expect(asRows(result.workflows)[0]).toMatchObject({
      status: "running",
      task_counts: { total: 2 },
      matching_task_counts: { total: 1 },
    })
  })
  it("pages discovered workflows with frozen time scope and rejects conflicting filters", async () => {
    for (let i = 0; i < 3; i++) {
      await db
        .query("UPSERT $id SET root_task_id = $root, aggregate_state = 'SUCCESS'", {
          id: new RecordId("workflow", `wf-${i}`),
          root: `wf-${i}`,
        })
        .collect()
      await task(`task-${i}`, { workflow_id: `wf-${i}` })
    }
    const first = await call("search_workflows", { limit: 1 })
    const cursor = (first.page as Row).next_cursor
    const next = await call("search_workflows", { cursor })
    expect(asRows(first.workflows)[0].workflow_id).not.toBe(asRows(next.workflows)[0].workflow_id)
    expect(next.effective_filters).toEqual(first.effective_filters)
    await expect(call("search_workflows", { cursor, status: "running" })).rejects.toMatchObject({
      code: "invalid_cursor",
    })
  })
  it("pages task rows, preserves out-of-page parent references, and browses child branches", async () => {
    await task("parent", { children: ["child"] })
    await task("child", { parent_id: "parent", state: "STARTED" })
    const result = await call("inspect_workflow", { workflow_id: "root", view: "tasks", limit: 1 })
    expect(asRows(result.tasks)[0]).toMatchObject({
      task_id: "child",
      parent_task_id: "parent",
      parent_record_available: true,
    })
    const next = await call("inspect_workflow", { workflow_id: "root", cursor: (result.page as Row).next_cursor })
    expect(asRows(next.tasks)[0]).toMatchObject({ task_id: "parent", observed_child_count: 1 })
    const children = await call("inspect_workflow", { workflow_id: "root", view: "tasks", parent_task_id: "parent" })
    expect(asRows(children.tasks).map((row) => row.task_id)).toEqual(["child"])
  })
  it("keeps large workflow overviews bounded and exposes name pagination", async () => {
    for (let i = 0; i < 30; i++) await task(`task-${i}`, { type: `reports.task${i}` })
    const overview = await call("inspect_workflow", { workflow_id: "root" })
    expect(overview.member_list_included).toBe(false)
    expect(asRows(overview.tasks)).toEqual([])
    expect(asRows(overview.task_names)).toHaveLength(8)
    expect(utf8Size(overview)).toBeLessThanOrEqual(MAX_RESPONSE_BYTES)
    const groups = await call("inspect_workflow", { workflow_id: "root", view: "task_names", limit: 2 })
    expect((groups.page as Row).has_more).toBe(true)
  })
  it("distinguishes unavailable payloads and source truncation, retrieving text in chunks", async () => {
    const output = "😀".repeat(3000)
    await task("payload", { result: output, result_truncated: true })
    const overview = await call("inspect_task", { task_id: "payload" })
    expect((overview.input as Row).args).toMatchObject({ availability: "unavailable", text: null })
    expect((overview.output as Row).result).toMatchObject({ source_truncated: true, response_truncated: true })
    let result = await call("inspect_task", { task_id: "payload", section: "output" })
    let collected = ""
    for (let i = 0; i < 10; i++) {
      const fields = result.fields as Row
      collected += String((fields.result as Row).text)
      expect(utf8Size(fields)).toBeLessThan(9 * 1024)
      if (!result.has_more) break
      result = await call("inspect_task", { task_id: "payload", cursor: result.next_cursor })
    }
    expect(collected).toBe(output)
  })
  it("pages event history in timestamp order", async () => {
    await task("task")
    for (let i = 0; i < 3; i++)
      await db
        .query("CREATE event CONTENT $data", {
          data: { task_id: "task", event_type: "task-started", timestamp: new Date(NOW + i * 1000) },
        })
        .collect()
    const first = await call("inspect_task", { task_id: "task", section: "history", limit: 1 })
    const next = await call("inspect_task", { task_id: "task", cursor: (first.page as Row).next_cursor })
    expect(asRows(next.events)[0].event_id).not.toEqual(asRows(first.events)[0].event_id)
  })
  it("does not treat missing inspection as idle or fresh", async () => {
    await worker("celery@host", { registered: ["reports.render"] })
    const result = await call("list_workers", { task_name: "render" })
    expect(asRows(result.workers)[0]).toMatchObject({
      hostname: "celery@host",
      activity_counts: { running: null, reserved: null, scheduled: null },
    })
    expect((result.meta as Row).warnings).not.toEqual([])
  })
  it("continues bounded capability scans through pages with no matches", async () => {
    await db
      .query("INSERT INTO worker $workers", {
        workers: Array.from({ length: 205 }, (_, index) => ({
          id: new RecordId("worker", `celery@${String(index).padStart(3, "0")}`),
          status: "online",
          last_updated: new Date(NOW),
          inspect: JSON.stringify({ registered: index === 204 ? ["reports.render"] : ["reports.publish"] }),
        })),
      })
      .collect()
    const first = await call("list_workers", { task_name: "render" })
    expect(first.workers).toEqual([])
    expect(first.page).toMatchObject({ total: null, has_more: true })
    const next = await call("list_workers", { cursor: (first.page as Row).next_cursor })
    expect(asRows(next.workers).map((row) => row.hostname)).toEqual(["celery@204"])
    expect(next.page).toMatchObject({ has_more: false })
  })
  it("pages registered names and queue details without inferring unavailable activity", async () => {
    await worker("celery@host", {
      registered: ["reports.render", "reports.publish"],
      active_queues: [{ name: "reports", exchange: { name: "reports" }, routing_key: "reports.#" }],
    })
    const overview = await call("inspect_worker", { hostname: "celery@host" })
    expect(overview.activity_counts).toMatchObject({ running: null, reserved: null, scheduled: null })
    const names = await call("inspect_worker", { hostname: "celery@host", section: "registered", limit: 1 })
    const next = await call("inspect_worker", { hostname: "celery@host", cursor: (names.page as Row).next_cursor })
    expect(asRows(names.registered)[0].name).toBe("reports.publish")
    expect(asRows(next.registered)[0].name).toBe("reports.render")
    const queues = await call("inspect_worker", { hostname: "celery@host", section: "queues" })
    expect(asRows(queues.queues)[0]).toMatchObject({ name: "reports", routing_key: "reports.#" })
  })
  it("preserves inspect-only task IDs and paginates worker snapshots", async () => {
    await worker("celery@host", {
      active: [
        { id: "missing", name: "reports.render" },
        { id: "stored", name: "reports.render" },
      ],
      reserved: [],
      scheduled: [],
    })
    await task("stored")
    const result = await call("inspect_worker", { hostname: "celery@host", section: "activity", limit: 1 })
    expect(asRows(result.activity)[0]).toMatchObject({
      task_id: "missing",
      workflow_id: null,
      task_record_available: false,
    })
    const next = await call("inspect_worker", { hostname: "celery@host", cursor: (result.page as Row).next_cursor })
    expect(asRows(next.activity)[0]).toMatchObject({
      task_id: "stored",
      workflow_id: "root",
      task_record_available: true,
    })
    await worker("celery@host", { active: [] })
    await expect(
      call("inspect_worker", { hostname: "celery@host", cursor: (result.page as Row).next_cursor }),
    ).rejects.toMatchObject({ code: "invalid_cursor" })
  })
  it("rejects ambiguous selectors and invalid relative times", async () => {
    await task("task")
    await expect(call("inspect_workflow", { workflow_id: "root", parent_task_id: "task" })).rejects.toMatchObject({
      code: "invalid_arguments",
    })
    await expect(call("search_workflows", { within: "999999d" })).rejects.toMatchObject({ code: "invalid_arguments" })
    await expect(call("search_workflows", { has_errors: "false" })).rejects.toMatchObject({ code: "invalid_arguments" })
  })
  it("serves MCP over stateless HTTP and enforces auth, host and origin", async () => {
    await task("task")
    const handler = createMcpHandler({
      db,
      cursorSecret: "secret",
      mode: () => "live",
      now: () => NOW,
    })
    const request = (body: Row, headers: Record<string, string> = {}, url = "http://localhost/mcp") =>
      new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers },
        body: JSON.stringify(body),
      })
    const body = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "search_workflows", arguments: {} } }
    const behindProxy = createMcpHandler({
      db,
      cursorSecret: "secret",
      mode: () => "live",
      publicOrigin: "https://insights.example",
    })
    expect(
      (
        await behindProxy(
          request({ jsonrpc: "2.0", id: 9, method: "tools/list" }, { origin: "https://insights.example" }),
        )
      ).status,
    ).toBe(200)
    expect((await behindProxy(request(body, { origin: "https://other.example" }))).status).toBe(403)

    expect((await handler(request(body))).status).toBe(200)
    expect((await handler(request(body, { origin: "https://other.example" }))).status).toBe(403)
    expect((await handler(request(body, {}, "http://other.example/mcp"))).status).toBe(403)
    const response = await handler(request(body, { "MCP-Protocol-Version": "2025-11-25" }))
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.result.structuredContent.workflows).toHaveLength(1)
    const list = await handler(request({ jsonrpc: "2.0", id: 2, method: "tools/list" }, {}))
    expect((await list.json()).result.tools.map((tool: Row) => tool.name)).toHaveLength(5)
  })
})

describe("MCP cursors", () => {
  it("rejects tampering, cross-tool reuse and expiry", () => {
    let now = NOW
    const cursors = new Cursors("secret", () => now)
    const cursor = cursors.encode("search_workflows", { limit: 1 }, "root")
    expect(() => cursors.resolve("search_workflows", { cursor: `${cursor}x` })).toThrow("Invalid cursor")
    expect(() => cursors.resolve("list_workers", { cursor })).toThrow("Invalid cursor")
    now += 16 * 60_000
    expect(() => cursors.resolve("search_workflows", { cursor })).toThrow("expired")
  })
})
