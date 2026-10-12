import { Surreal } from "surrealdb"
import type { ReadRequest } from "../../runtime/observation/queries"
import { benchmarkHeaders } from "./ingress"
import { extractId } from "../../src/types/surreal-records"

export function observationClient() {
  const Socket = class extends WebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, {
        headers: {
          ...benchmarkHeaders(),
          "Sec-WebSocket-Protocol": typeof protocols === "string" ? protocols : (protocols?.join(",") ?? "cbor"),
        },
      } as unknown as string[])
    }
  }
  return new Surreal({ websocketImpl: Socket })
}

/** The production browser contract: typed requests, no database credentials or SQL. */
export async function connectObservation(db: Surreal, url: string) {
  await Promise.race([
    db.connect(`${url.replace(/^http/, "ws")}/api/observation/rpc`, { reconnect: false }),
    new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error("Observation connection deadline exceeded")), 15000)
      timer.unref()
    }),
  ])
}

export async function readObservation<T extends unknown[]>(db: Surreal, request: ReadRequest): Promise<T> {
  return (await db.query<T>("observation:read", { request }).collect()) as T
}

export async function readAllObservation(db: Surreal, table: ReadRequest["table"], query = "") {
  const records: Record<string, unknown>[] = []
  while (true) {
    const [page] = await readObservation<[Record<string, unknown>[]]>(db, {
      operation: "list",
      table,
      query,
      limit: 1000,
      offset: records.length,
    })
    records.push(...page)
    if (page.length < 1000) return records
  }
}

/** Public task membership; this does not expose or validate private relation record IDs. */
export async function readPublicWorkflowMembership(db: Surreal) {
  const [workflows, tasks] = await Promise.all([readAllObservation(db, "workflow"), readAllObservation(db, "task")])
  return { workflows, edges: tasks.map((task) => ({ in: task.workflow_id, out: extractId(task.id) })) }
}
