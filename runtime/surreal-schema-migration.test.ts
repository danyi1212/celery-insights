// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { Surreal } from "surrealdb"
import { parseConfig } from "./config"
import { CORE_SCHEMA, runSchemaMigration } from "./surreal-schema"
import { startSurrealTestServer, type SurrealTestServer } from "./surreal-test-server"

const OBSERVED_FLAG = "DEFINE FIELD OVERWRITE last_updated_observed ON task TYPE bool DEFAULT false;\n"
const silent = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as never

let server: SurrealTestServer
let db: Surreal

describe("runSchemaMigration against SurrealDB", () => {
  beforeAll(async () => {
    server = await startSurrealTestServer()
    db = new Surreal()
    await db.connect(server.endpoint, { authentication: { username: "root", password: "root" } })
    await db.use({ namespace: "migration", database: "upgrade" })
  }, 30_000)
  afterAll(async () => {
    await db?.close()
    server?.stop()
  })

  it("marks undated imports written before last_updated_observed existed", async () => {
    expect(CORE_SCHEMA).toContain(OBSERVED_FLAG)
    await db.query(CORE_SCHEMA.replace(OBSERVED_FLAG, "")).collect()
    await db
      .query(
        "CREATE task:old_import SET state = 'STARTED', workflow_id = 'old_import', last_updated = time::now(); " +
          "CREATE task:event_started SET state = 'STARTED', workflow_id = 'event_started', last_updated = time::now(), started_at = time::now(); " +
          "CREATE task:finished SET state = 'SUCCESS', workflow_id = 'finished', last_updated = time::now()",
      )
      .collect()
    const [seeded] = await db.query<[{ id: string }[]]>("SELECT record::id(id) AS id FROM task ORDER BY id").collect()
    expect(seeded.map((row) => row.id)).toEqual(["event_started", "finished", "old_import"])

    const config = parseConfig({
      SURREALDB_EXTERNAL_URL: server.endpoint,
      SURREALDB_NAMESPACE: "migration",
      SURREALDB_DATABASE: "upgrade",
    })
    await runSchemaMigration(config, silent)
    await runSchemaMigration(config, silent)

    const [rows] = await db
      .query<[{ id: string; last_updated_observed: boolean }[]]>(
        "SELECT record::id(id) AS id, last_updated_observed FROM task ORDER BY id",
      )
      .collect()
    expect(rows).toEqual([
      { id: "event_started", last_updated_observed: false },
      { id: "finished", last_updated_observed: false },
      { id: "old_import", last_updated_observed: true },
    ])
  }, 30_000)

  it("backfills the last positive observation from a current positive observation", async () => {
    await db
      .query(
        "CREATE task:observed_running, task:observed_idle SET state = 'STARTED', workflow_id = 'root', " +
          "last_updated = d'2026-10-06T12:00:00Z', execution_observed_at = d'2026-10-06T12:10:00Z'; " +
          "UPDATE task:observed_running SET execution_active = true; " +
          "UPDATE task:observed_idle SET execution_active = false",
      )
      .collect()
    await runSchemaMigration(
      parseConfig({
        SURREALDB_EXTERNAL_URL: server.endpoint,
        SURREALDB_NAMESPACE: "migration",
        SURREALDB_DATABASE: "upgrade",
      }),
      silent,
    )

    const [rows] = await db
      .query<[{ id: string; execution_active_at?: Date }[]]>(
        "SELECT record::id(id) AS id, execution_active_at FROM [task:observed_idle, task:observed_running]",
      )
      .collect()
    expect(rows.map((row) => [row.id, row.execution_active_at?.toISOString()])).toEqual([
      ["observed_idle", undefined],
      ["observed_running", "2026-10-06T12:10:00.000Z"],
    ])
  }, 30_000)
})
