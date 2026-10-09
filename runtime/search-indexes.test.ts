// @vitest-environment node
import { spawn, type ChildProcess } from "node:child_process"
import { createServer } from "node:net"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { Surreal } from "surrealdb"
import fixtures from "../src/lib/task-search-fixtures.json"
import { extractId } from "../src/types/surreal-records"
import { kwargsSearchTerms, buildTaskSearch, buildWorkflowSearch } from "../src/lib/task-search"
import { buildIndexedTaskSearch, buildIndexedWorkflowSearch } from "../src/lib/indexed-search"
import { CORE_SCHEMA } from "./surreal-schema"
import { SEARCH_PROJECTION_SCHEMA, SearchIndexes } from "./search-indexes"
import { ObservationApi } from "./observation-api"
import { parseConfig } from "./config"

describe("search projections on disk", () => {
  let db: Surreal
  let process: ChildProcess
  let indexes: SearchIndexes
  let api: ObservationApi
  beforeAll(async () => {
    const directory = await mkdtemp(`${tmpdir()}/celery-search-indexes-`)
    const port = await new Promise<number>((resolve) => {
      const socket = createServer()
      socket.listen(0, "127.0.0.1", () => {
        const address = socket.address() as { port: number }
        socket.close(() => resolve(address.port))
      })
    })
    process = spawn(
      "surreal",
      ["start", "--bind", `127.0.0.1:${port}`, "--user", "root", "--pass", "root", `surrealkv://${directory}/data`],
      { stdio: "ignore" },
    )
    for (let attempt = 0; attempt < 200; attempt++) {
      try {
        if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    db = new Surreal()
    await db.connect(`ws://127.0.0.1:${port}/rpc`, { authentication: { username: "root", password: "root" } })
    await db.use({ namespace: "test", database: "search" })
    await db.query(CORE_SCHEMA).collect()
    for (const fixture of fixtures.tasks) {
      const { id, ...content } = fixture
      const source = "format" in content ? String(content.format).replace("_compact", "") : undefined
      await db
        .query("CREATE type::record('task', $id) CONTENT $content", {
          id,
          content: {
            state: "SUCCESS",
            workflow_id: id,
            last_updated: new Date(),
            ...Object.fromEntries(Object.entries(content).filter(([key]) => key !== "format")),
            kwargs_search_source: source,
          },
        })
        .collect()
    }
    for (const { id, ...content } of fixtures.workflows) {
      await db
        .query("CREATE type::record('workflow', $id) CONTENT $content", {
          id,
          content: { aggregate_state: "SUCCESS", last_updated: new Date(), ...content },
        })
        .collect()
    }
    indexes = new SearchIndexes(db)
    api = new ObservationApi(db, parseConfig({}), async () => null)
  }, 20_000)
  afterAll(async () => {
    await indexes?.stop()
    await db?.close()
    process?.kill()
  })

  const taskIds = async (query: string) => {
    const search = buildIndexedTaskSearch(query)
    const results = await db
      .query<{ id: unknown }[][]>(
        `${search.prelude.join("")}SELECT id FROM ${search.source} WHERE (${search.clause})`,
        search.bindings,
      )
      .collect()
    return results
      .at(-1)!
      .map((row) => extractId(row.id))
      .sort()
  }
  const checkFixtures = async () => {
    const exportIds = async (mode: "tasks" | "workflows", query: string) => {
      const response = await api.exportCsv({
        kind: "explorer",
        mode,
        query,
        from: "2000-01-01T00:00:00Z",
        to: "2100-01-01T00:00:00Z",
      })
      // Split at record boundaries, allowing quoted cells to contain newlines and doubled quotes.
      const rows = (await response.text())
        .split(/\r\n(?=(?:[^"]*"[^"]*")*[^"]*$)/)
        .slice(1)
        .filter(Boolean)
      return rows.map((row) => row.match(/^"((?:[^"]|"")*)"/)![1].replaceAll('""', '"')).sort()
    }
    for (const { query, expected } of fixtures.queries) {
      expect(await taskIds(query)).toEqual(expected)
      expect(await exportIds("tasks", query)).toEqual(expected)
    }
    for (const { query, expected } of fixtures.workflowQueries) {
      const search = buildIndexedWorkflowSearch(query)
      const results = await db
        .query<{ id: unknown }[][]>(
          `${search.prelude.join("")}SELECT id FROM ${search.source} WHERE (${search.clause})`,
          {
            ...search.bindings,
            from: "2000-01-01T00:00:00Z",
            to: "2100-01-01T00:00:00Z",
          },
        )
        .collect()
      expect(
        results
          .at(-1)!
          .map((row) => extractId(row.id))
          .sort(),
      ).toEqual(expected)
      expect(await exportIds("workflows", query)).toEqual(expected)
    }
  }

  it("preserves all shared task and workflow fixtures before indexes exist", async () => {
    await checkFixtures()
    expect(await taskIds("organization_id=1")).toContain("one")
  })
  it("backfills existing records and preserves all fixtures when enabled", async () => {
    await indexes.start(true)
    const [grams] = await db.query("RETURN fn::search_grams('North team')").collect()
    expect(grams).toEqual(["nor", "ort", "rth", "th ", "h t", " te", "tea", "eam"])
    await checkFixtures()
    const [rows] = await db
      .query<Record<string, unknown>[][]>("SELECT * FROM task_search WHERE record = task:big")
      .collect()
    expect(rows[0].kwargs_terms).toContain('["organization_id",["number","9007199254740993"]]')
  }, 20_000)
  it("uses original queries throughout a build and when an index is missing", async () => {
    await db
      .query("UPDATE search_config:current SET ready = false; REMOVE INDEX ci_search_task_grams ON task_search;")
      .collect()
    await checkFixtures()
    expect(await taskIds("organization_id=1")).toContain("one")
    await db.query("UPDATE search_config:current SET ready = true;").collect()
    await checkFixtures()
    await db.query(SEARCH_PROJECTION_SCHEMA).collect()
  })
  it("rejects conflicting shared-database configuration before changing maintenance", async () => {
    const other = new SearchIndexes(db)
    await expect(other.start(false)).rejects.toThrow("conflicts")
    expect(await taskIds("organization_id=1")).toEqual(
      fixtures.queries.find((row) => row.query === "organization_id=1")!.expected,
    )
  })
  it("keeps large payload tails and Unicode substring searches complete", async () => {
    await db
      .query(
        "CREATE task:large SET state = 'SUCCESS', workflow_id = 'large', last_updated = time::now(), result = $result, args = $args, kwargs = $kwargs",
        {
          result: "x".repeat(100 * 1024) + "unique-result-tail",
          args: "y".repeat(600) + "unique-args-tail",
          kwargs: "{'text': 'abc😀def İSTANBUL Straße'}",
        },
      )
      .collect()
    for (const query of ["unique-result-tail", "unique-args-tail", "abc😀def", "Straße", "İSTANBUL"])
      expect(await taskIds(query)).toContain("large")
    const [projection] = await db.query<Record<string, unknown>[][]>("SELECT * FROM task_search:large").collect()
    expect(projection[0].text_fallback).toBe(true)
    expect(JSON.stringify(projection[0]).length).toBeLessThan(10_000)
    await db.query("DELETE task:large").collect()
    const [deleted] = await db.query<unknown[][]>("SELECT * FROM task_search:large").collect()
    expect(deleted).toEqual([])
  })
  it("finds Unicode candidates within the projection bound", async () => {
    await db
      .query(
        "CREATE task:unicode SET state = 'SUCCESS', workflow_id = 'unicode', last_updated = time::now(), args = $args",
        {
          args: "abc😀def İSTANBUL Straße",
        },
      )
      .collect()
    const [projection] = await db
      .query<{ text_fallback: boolean }[][]>("SELECT text_fallback FROM task_search:unicode")
      .collect()
    expect(projection[0].text_fallback).toBe(false)
    for (const query of ["abc😀def", "Straße", "İSTANBUL"]) expect(await taskIds(query)).toContain("unicode")
    await db.query("DELETE task:unicode").collect()
  })
  it("preserves time-filtered counts, ordering and pagination for tasks and workflow members", async () => {
    for (let offset = 0; offset < 8; offset++) {
      const id = `page-${offset}`
      const timestamp = new Date(offset === 0 ? "2024-01-01" : `2026-10-0${offset}`)
      await db
        .query(
          `CREATE type::record('task', $id) SET state = 'SUCCESS', workflow_id = $id,
        type = 'paging-needle', kwargs = "{'scoped': 7}", last_updated = $timestamp;
        CREATE type::record('workflow', $id) SET aggregate_state = 'SUCCESS', root_task_id = $id,
        last_updated = $timestamp;`,
          { id, timestamp },
        )
        .collect()
    }
    const bindings = { from: "2026-10-01T00:00:00Z", to: "2026-10-08T00:00:00Z" }
    for (const table of ["task", "workflow"] as const) {
      const query = table === "task" ? "paging-needle" : "scoped=7"
      const original =
        table === "task" ? { ...buildTaskSearch(query), prelude: [] as string[] } : buildWorkflowSearch(query)
      const indexed = table === "task" ? buildIndexedTaskSearch(query) : buildIndexedWorkflowSearch(query)
      const run = async (
        source: string,
        prelude: string[],
        clause: string,
        searchBindings: Record<string, unknown>,
        start: number,
      ) => {
        const results = await db
          .query(
            `${prelude.join("")}
          SELECT count() AS count FROM ${source} WHERE (${clause}) AND last_updated >= <datetime>$from AND last_updated <= <datetime>$to GROUP ALL;
          SELECT id, last_updated FROM ${source} WHERE (${clause}) AND last_updated >= <datetime>$from AND last_updated <= <datetime>$to ORDER BY last_updated DESC LIMIT 3 START $start;`,
            { ...searchBindings, ...bindings, start },
          )
          .collect()
        return results.slice(-2)
      }
      for (const start of [0, 3, 6]) {
        const expected = await run(table, original.prelude, original.clause, original.bindings, start)
        expect(await run(indexed.source, indexed.prelude, indexed.clause, indexed.bindings, start)).toEqual(expected)
        expect(expected[0]).toEqual([{ count: 7 }])
      }
    }
    await db
      .query(
        "DELETE task WHERE type = 'paging-needle'; DELETE workflow WHERE string::starts_with(root_task_id, 'page-');",
      )
      .collect()
  })
  it("does not rebuild projections on state-only changes and falls back for changed unknown kwargs", async () => {
    const [before] = await db.query<unknown[][]>("SELECT * FROM task_search:one").collect()
    await db.query("UPDATE task:one SET state = 'STARTED'").collect()
    const [after] = await db.query<unknown[][]>("SELECT * FROM task_search:one").collect()
    expect(after).toEqual(before)
    await db.query("UPDATE task:one SET kwargs = '{\"organization_id\": 42}'").collect()
    expect(await taskIds("organization_id=42")).toContain("one")
    expect(await taskIds("organization_id=1")).not.toContain("one")
  })
  it("removes existing projections, indexes and events when disabled and can reenable", async () => {
    await indexes.stop()
    indexes = new SearchIndexes(db)
    await indexes.start(false)
    const [info] = await db.query<{ tables: Record<string, string> }[]>("INFO FOR DB").collect()
    expect(info.tables).not.toHaveProperty("task_search")
    const [taskInfo] = await db.query<{ events: Record<string, string> }[]>("INFO FOR TABLE task").collect()
    expect(taskInfo.events).not.toHaveProperty("ci_search_task")
    await db.query("UPDATE task:one SET kwargs = '{\"organization_id\": 99}'").collect()
    expect(await taskIds("organization_id=99")).toContain("one")
    await indexes.stop()
    indexes = new SearchIndexes(db)
    await indexes.start(true)
    expect(await taskIds("organization_id=99")).toContain("one")
  })
})

it("never guesses ambiguous or unknown kwargs formats", () => {
  expect(kwargsSearchTerms("{'id': 1}", null).fallback).toBe(true)
  expect(kwargsSearchTerms("{'path': 'a\\nb', 'id': 1}", "saferepr").fallback).toBe(true)
  expect(kwargsSearchTerms("{'id': 1, 'bytes': b'it's'}", "saferepr").fallback).toBe(true)
})
