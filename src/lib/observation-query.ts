import type { Surreal } from "surrealdb"
import type { ReadRequest } from "../../runtime/observation/queries"

const remote = new WeakSet<Surreal>()
export const markRemoteObservation = (db: Surreal): void => {
  remote.add(db)
}
/** Production sends typed requests. SQL is used only by the local demo and test fixtures. */
export function queryObservation<T extends unknown[]>(
  db: Surreal,
  request: ReadRequest | undefined,
  demoSql: string,
  bindings?: Record<string, unknown>,
) {
  if (!remote.has(db)) return bindings === undefined ? db.query<T>(demoSql) : db.query<T>(demoSql, bindings)
  if (!request) throw new Error("Typed observation request required")
  return db.query<T>("observation:read", { request })
}
export const isObservationRefresh = (value: unknown): boolean =>
  !!value && typeof value === "object" && "__observation_refresh" in value && value.__observation_refresh === true
