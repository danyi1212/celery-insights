// @vitest-environment node
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { Surreal } from "surrealdb"
import { createWasmEngines } from "@surrealdb/wasm"
import { DEMO_SCHEMA } from "./demo-schema"
import { buildIndexedTaskSearch, buildIndexedWorkflowSearch } from "./indexed-search"

it("keeps exact and substring searches available in the demo WASM engine", async () => {
  const fetch = globalThis.fetch
  // Node's fetch does not support file URLs; load the actual WASM bytes from disk.
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    if (input instanceof URL && input.protocol === "file:") return new Response(await readFile(fileURLToPath(input)))
    return fetch(input, init)
  })
  const db = new Surreal({ engines: createWasmEngines() })
  try {
    await db.connect("mem://")
    await db.use({ namespace: "test", database: "search" })
    await db.query(DEMO_SCHEMA).collect()
    await db
      .query(`CREATE task:one SET state = 'SUCCESS', workflow_id = 'one', last_updated = time::now(), kwargs = '{"organization_id": 1}', args = '["partialWord"]';
      CREATE workflow:one SET root_task_id = 'one', aggregate_state = 'SUCCESS', last_updated = time::now();`)
      .collect()
    for (const query of ["organization_id=1", "partial"]) {
      const search = buildIndexedTaskSearch(query)
      const results = await db
        .query<unknown[][]>(
          `${search.prelude.join("")}SELECT id FROM ${search.source} WHERE (${search.clause})`,
          search.bindings,
        )
        .collect()
      expect(results.at(-1)).toHaveLength(1)
    }
    const search = buildIndexedWorkflowSearch("organization_id=1")
    const results = await db
      .query<unknown[][]>(`${search.prelude.join("")}SELECT id FROM ${search.source} WHERE (${search.clause})`, {
        ...search.bindings,
        from: "2000-01-01T00:00:00Z",
        to: "2100-01-01T00:00:00Z",
      })
      .collect()
    expect(results.at(-1)).toHaveLength(1)
  } finally {
    await db.close()
    vi.unstubAllGlobals()
  }
}, 15_000)
