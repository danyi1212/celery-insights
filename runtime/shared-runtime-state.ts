import type { Surreal } from "surrealdb"

type Database = Pick<Surreal, "query">

/** OWNER-only diagnostics shared by the ingestion leader and API replicas. */
export async function publishBridgeStatus(db: Database, status: Record<string, unknown>): Promise<void> {
  await db
    .query("UPSERT runtime_state:ingestion CONTENT $status", {
      status: { ...status, updated_at: new Date() },
    })
    .collect()
}

export async function readBridgeStatus(db: Database): Promise<Record<string, unknown> | null> {
  const [rows] = await db
    .query<[Record<string, unknown>[]]>("SELECT * FROM runtime_state:ingestion WHERE updated_at > time::now() - 15s")
    .json()
    .collect()
  return rows?.[0] ?? null
}
