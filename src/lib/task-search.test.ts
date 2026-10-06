// @vitest-environment node
import { spawn, type ChildProcess } from "node:child_process"
import { createServer } from "node:net"
import { Surreal } from "surrealdb"
import { extractId } from "@/types/surreal-records"
import { buildTaskSearch, buildWorkflowSearch } from "./task-search"

describe("task search against SurrealDB", () => {
  let db: Surreal
  let databaseProcess: ChildProcess

  beforeAll(async () => {
    const port = await new Promise<number>((resolve, reject) => {
      const socket = createServer()
      socket.on("error", reject)
      socket.listen(0, "127.0.0.1", () => {
        const address = socket.address()
        if (!address || typeof address === "string") return reject(new Error("No local port available"))
        socket.close(() => resolve(address.port))
      })
    })
    databaseProcess = spawn(
      "surreal",
      ["start", "--bind", `127.0.0.1:${port}`, "--user", "root", "--pass", "root", "memory"],
      { stdio: "ignore" },
    )
    let failure: Error | undefined
    databaseProcess.on("error", (error) => {
      failure = error
    })
    for (let attempt = 0; attempt < 100; attempt++) {
      if (failure) throw failure
      try {
        if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break
      } catch {
        // The isolated test database has not started listening yet.
      }
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    db = new Surreal()
    await db.connect(`ws://127.0.0.1:${port}/rpc`)
    await db.signin({ username: "root", password: "root" })
    await db.use({ namespace: "test", database: "search" })
    await db.query(
      `
      CREATE task:one CONTENT {workflow_id: 'one', kwargs: "{'organization_id': 1, 'run_id': 'Run.A', 'enabled': True, 'label': 'North team'}"};
      CREATE task:ten CONTENT {workflow_id: 'two', kwargs: '{"organization_id": 10}'};
      CREATE task:json CONTENT {workflow_id: 'two', kwargs: '{"organization_id": 1, "enabled": true}'};
      CREATE task:string CONTENT {kwargs: "{'organization_id': '1'}"};
      CREATE task:missing CONTENT {type: 'reports.render'};
      CREATE task:containers CONTENT {kwargs: "{'families': ['ad', 'query'], 'options': {'enabled': True, 'end': None}, 'empty': [], 'channel': 'FacebookAds'}"};
      CREATE task:big CONTENT {kwargs: "{'organization_id': 9007199254740993, 'ratio': 1.0, 'count': 1000}"};
      CREATE task:inside CONTENT {kwargs: "{'message': \\"{'organization_id': 1}\\", 'organization_id': 2}"};
      CREATE task:apostrophe CONTENT {kwargs: "{'note': \\"it's {\\", 'organization_id': 3}"};
      CREATE task:ordered CONTENT {kwargs: "{'options': {'2': 'b', '1': 'a'}}"};
      CREATE task:failed CONTENT {kwargs: "{'retries': 3}", exception: "MaxRetriesExceededError: status=failed, retries=3 exceeded"};
      CREATE task:keyword CONTENT {kwargs: "{'kind': 'constructor', 'tags': ['constructor']}"};
      CREATE task:control CONTENT {kwargs: $control};
      CREATE workflow:one CONTENT {root_task_id: 'one', root_task_type: 'reports.render'};
      CREATE workflow:two CONTENT {root_task_id: 'two', root_task_type: 'sync'};
      CREATE workflow:three CONTENT {root_task_id: 'three', root_task_type: 'sync', latest_exception_preview: 'Timeout'};
    `,
      { control: String.raw`{'label': '\x01', 'tags': ['\u200b'], 'nested': {'key': '\x7f'}, 'plain': 'café'}` },
    )
  })

  afterAll(async () => {
    await db?.close()
    databaseProcess?.kill()
  })

  it.each([
    ["organization_id=1", ["json", "one"]],
    ["organization_id = 10", ["ten"]],
    ['organization_id="1"', ["string"]],
    ["enabled=true", ["containers", "json", "one"]],
    ["run_id=Run.A", ["one"]],
    ["run_id=RunXA", []],
    ['label="North team"', ["one"]],
    ["north TEAM", ["one"]],
    ["reports.render", ["missing"]],
    ['families=["ad", "query"]', ["containers"]],
    ['options={"enabled":true,"end":null}', ["containers"]],
    ['families=["query", "ad"]', []],
    ["empty=[]", ["containers"]],
    ["channel=FacebookAds", ["containers"]],
    ["families=['ad', 'query']", ["containers"]],
    ["options={'enabled': True, 'end': None}", ["containers"]],
    ["label='North team'", ["one"]],
    ["organization_id=9007199254740993", ["big"]],
    ["organization_id=9007199254740992", []],
    ["ratio=1.0", ["big"]],
    ["ratio=1", []],
    ["count=1e3", []],
    ["organization_id=2", ["inside"]],
    ["organization_id=3", ["apostrophe"]],
    ["note=it's {", ["apostrophe"]],
    ['options={"2":"b","1":"a"}', ["ordered"]],
    ['options={"1":"a","2":"b"}', []],
    ["label='", []],
    ["status=failed", ["failed"]],
    ["retries=3 exceeded", ["failed"]],
    ["retries=3", ["failed"]],
    ["kind=constructor", ["keyword"]],
    ["tags=['constructor']", ["keyword"]],
    ["tags=[constructor]", []],
    [String.raw`label='\x01'`, ["control"]],
    [String.raw`tags=['\u200b']`, ["control"]],
    [String.raw`nested={'key': '\x7f'}`, ["control"]],
    [String.raw`plain='caf\xe9'`, ["control"]],
    ["plain=café", ["control"]],
  ])("finds %s", async (query, expected) => {
    const { clause, bindings } = buildTaskSearch(query)
    const [rows] = await db.query<[{ id: unknown }[]]>(`SELECT id FROM task WHERE (${clause})`, bindings)
    expect(rows.map((row) => extractId(row.id)).sort()).toEqual(expected)
  })

  it.each([
    ["organization_id=1", ["one", "two"]],
    ["organization_id=10", ["two"]],
    ["north team", ["one"]],
    ["sync", ["three", "two"]],
    ["timeout", ["three"]],
    ["organization_id=2", []],
  ])("finds workflows for %s", async (query, expected) => {
    const { prelude, clause, bindings } = buildWorkflowSearch(query)
    const [, rows] = await db.query<[null, { id: unknown }[]]>(
      `${prelude}SELECT id FROM workflow WHERE (${clause})`,
      bindings,
    )
    expect(rows.map((row) => extractId(row.id)).sort()).toEqual(expected)
  })
})
