// @vitest-environment node
import { spawn, type ChildProcess } from "node:child_process"
import { createServer } from "node:net"
import { Surreal } from "surrealdb"
import { extractId } from "@/types/surreal-records"
import { buildTaskSearch } from "./task-search"

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
    await db.query(`
      CREATE task:one CONTENT {kwargs: "{'organization_id': 1, 'run_id': 'Run.A', 'enabled': True, 'label': 'North team'}"};
      CREATE task:ten CONTENT {kwargs: '{"organization_id": 10}'};
      CREATE task:json CONTENT {kwargs: '{"organization_id": 1, "enabled": true}'};
      CREATE task:string CONTENT {kwargs: "{'organization_id': '1'}"};
      CREATE task:missing CONTENT {type: 'reports.render'};
      CREATE task:containers CONTENT {kwargs: "{'families': ['ad', 'query'], 'options': {'enabled': True, 'end': None}, 'empty': [], 'channel': 'FacebookAds'}"};
    `)
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
    ["organization_id=2", []],
    ["north TEAM", ["one"]],
    ["reports.render", ["missing"]],
    ['families=["ad", "query"]', ["containers"]],
    ['options={"enabled":true,"end":null}', ["containers"]],
    ['families=["query", "ad"]', []],
    ["empty=[]", ["containers"]],
    ["channel=FacebookAds", ["containers"]],
  ])("finds %s", async (query, expected) => {
    const { clause, bindings } = buildTaskSearch(query)
    const [rows] = await db.query<[{ id: unknown }[]]>(`SELECT id FROM task WHERE (${clause})`, bindings)
    expect(rows.map((row) => extractId(row.id)).sort()).toEqual(expected)
  })
})
