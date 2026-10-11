// @vitest-environment node
import { afterAll, beforeAll, expect, it } from "vitest"
import { Surreal } from "surrealdb"
import { parseConfig } from "./config"
import { ObservationApi } from "./observation-api"
import { publishBridgeStatus, readBridgeStatus } from "./shared-runtime-state"
import { CORE_SCHEMA } from "./surreal-schema"
import { startSurrealTestServer, type SurrealTestServer } from "./surreal-test-server"

let server: SurrealTestServer
const writer = new Surreal()
const replica = new Surreal()
beforeAll(async () => {
  server = await startSurrealTestServer()
  for (const db of [writer, replica]) {
    await db.connect(server.endpoint, { authentication: { username: "root", password: "root" } })
    await db.use({ namespace: "shared_state", database: "test" })
  }
  await writer.query(CORE_SCHEMA).collect()
}, 30000)
afterAll(async () => {
  await Promise.all([writer.close(), replica.close()])
  server?.stop()
})

it("serves leader diagnostics on another connection and expires stale snapshots", async () => {
  expect(await readBridgeStatus(replica)).toBeNull()
  await publishBridgeStatus(writer, { python_version: "fixture", ingestion: { events_ingested_total: 42 } })
  expect((await readBridgeStatus(replica))?.ingestion).toEqual({ events_ingested_total: 42 })
  await writer.query("UPDATE runtime_state:ingestion SET updated_at = time::now() - 20s").collect()
  expect(await readBridgeStatus(replica)).toBeNull()
})

it("retention changes reach independent API and cleanup instances", async () => {
  const api = new ObservationApi(writer, parseConfig({}), async () => null)
  const independent = new ObservationApi(replica, parseConfig({}), async () => null)
  const settings = {
    cleanup_interval_seconds: 15,
    task_max_count: 0,
    task_retention_hours: null,
    dead_worker_retention_hours: null,
  }
  await api.handle(
    new Request("http://local/api/settings/retention", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(settings),
    }),
    "/api/settings/retention",
    false,
  )
  const response = await independent.handle(
    new Request("http://local/api/settings/retention"),
    "/api/settings/retention",
    false,
  )
  expect((await response!.json()).settings).toEqual(settings)
  await writer
    .query(
      "CREATE task:sample SET state = 'SUCCESS', workflow_id = 'sample', last_updated = time::now(); CREATE workflow:sample SET root_task_id = 'sample', aggregate_state = 'SUCCESS', task_count = 1, last_updated = time::now(); RELATE workflow:sample->workflow_task:sample->task:sample",
    )
    .collect()
  await independent.cleanup()
  expect(await independent.counts()).toEqual({ tasks: 0, events: 0, workers: 0 })
  expect(independent.cleanupInterval()).toBe(15000)
})
