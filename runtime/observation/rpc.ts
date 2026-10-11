import { CborCodec, RecordId, Uuid, type Surreal } from "surrealdb"
import { z } from "zod"
import type { AuthenticationHttp } from "../security/http"
import { AuthError } from "../security/permissions"
import { intersectScopes, scopeFingerprint, scopedDatabase, type ReadScope } from "../security/read-scope"
import { buildRead, readPermissions, readRequestSchema } from "./queries"

const tables = new Set(["task", "worker", "workflow", "event"])
const envelope = z
  .object({
    id: z.union([z.string().max(256), z.number().int()]),
    method: z.string().max(32),
    params: z.array(z.unknown()).max(3).default([]),
    session: z.unknown().optional(),
    txn: z.unknown().optional(),
  })
  .strict()
export interface ObservationSocket {
  send(data: string | Uint8Array): unknown
  close(code: number, reason: string): unknown
}
/** SDK wire compatibility only. No client SQL, credentials or database sessions reach SurrealDB. */
export class ObservationRpc {
  private closed = false
  private pending = 0
  private tail = Promise.resolve()
  private readonly subscriptions = new Map<string, Uuid>()
  private readonly timer: ReturnType<typeof setInterval>
  constructor(
    private readonly socket: ObservationSocket,
    private readonly auth: AuthenticationHttp,
    private readonly account: string,
    private readonly db: Pick<Surreal, "query">,
    private readonly initialScope: ReadScope,
    private readonly replay: boolean,
    private readonly json = false,
    interval = 5000,
    private readonly authRequest?: Request,
  ) {
    this.timer = setInterval(() => void this.enqueue(() => this.refresh()), interval)
  }
  stop(): void {
    this.closed = true
    clearInterval(this.timer)
    this.subscriptions.clear()
  }
  private close(): void {
    this.stop()
    this.socket.close(1008, "Authorization unavailable")
  }
  private async principal() {
    const principal = this.authRequest
      ? await this.auth.authenticate(this.authRequest)
      : this.auth.accountPrincipal(this.account)
    if (!principal) throw new AuthError(403, "Account unavailable")
    return principal
  }
  private async scope(
    operation?: string,
    actions = ["task.metadata.read"] as ReturnType<typeof readPermissions>,
  ): Promise<ReadScope> {
    const current = await this.auth.authorization.check(
      await this.principal(),
      actions,
      { method: "GET", path: "/api/observation/rpc", transport: "websocket", ...(operation ? { operation } : {}) },
      this.replay,
    )
    if (!operation && scopeFingerprint(current) !== scopeFingerprint(this.initialScope))
      throw new AuthError(403, "Read scope changed")
    return intersectScopes(this.initialScope, current)
  }
  private send(value: unknown): void {
    if (this.closed) return
    const encoded = this.json ? JSON.stringify(value) : CborCodec.DEFAULT.encode(value)
    if ((typeof encoded === "string" ? Buffer.byteLength(encoded) : encoded.byteLength) > 16 * 1024 * 1024)
      throw new Error("Observation response too large")
    this.socket.send(encoded)
  }
  private enqueue(work: () => Promise<void>): Promise<void> {
    if (this.closed) return Promise.resolve()
    if (++this.pending > 64) {
      this.close()
      return Promise.resolve()
    }
    this.tail = this.tail.then(async () => {
      try {
        if (!this.closed) await work()
      } catch {
        this.close()
      } finally {
        this.pending--
      }
    })
    return this.tail
  }
  receive(message: string | Uint8Array): Promise<void> {
    if (message.length > 65536) {
      this.close()
      return Promise.resolve()
    }
    return this.enqueue(async () => {
      const raw = this.json
        ? JSON.parse(String(message))
        : CborCodec.DEFAULT.decode(typeof message === "string" ? new TextEncoder().encode(message) : message)
      const rpc = envelope.parse(raw)
      await this.scope()
      try {
        if (rpc.txn !== undefined) throw new AuthError(403, "Transactions are not available")
        let result: unknown
        switch (rpc.method) {
          case "version":
            result = "surrealdb-3.3.0"
            break
          case "ping":
          case "health":
            result = null
            break
          case "query": {
            const [sql, bindings] = rpc.params
            if (typeof sql !== "string") throw new AuthError(403, "Typed observation request required")
            const live = /^LIVE SELECT \* FROM (task|worker|workflow|event);?$/.exec(sql)
            const boundLive = /^LIVE SELECT \* FROM (\$[A-Za-z_][A-Za-z0-9_]*);?$/.exec(sql)
            const boundTable =
              boundLive && bindings && typeof bindings === "object"
                ? String((bindings as Record<string, unknown>)[boundLive[1].slice(1)])
                : ""
            if (live || (boundLive && tables.has(boundTable))) {
              if (this.subscriptions.size >= 32) throw new AuthError(403, "Too many subscriptions")
              const id = Uuid.v4()
              this.subscriptions.set(id.toString(), id)
              result = [{ status: "OK", time: "0ns", result: id }]
            } else {
              const kill = /^KILL u["']([0-9a-f-]{36})["'];?$/.exec(sql)
              if (kill && this.subscriptions.delete(kill[1])) result = [{ status: "OK", time: "0ns", result: null }]
              else {
                if (sql !== "observation:read") throw new AuthError(403, "Only typed observation reads are available")
                const input = z.object({ request: readRequestSchema }).strict().parse(bindings).request
                const scope = await this.scope(input.operation, readPermissions(input, await this.principal()))
                const read = buildRead(input)
                const rows = await scopedDatabase(this.db, scope).query(read.sql, read.bindings)
                const fresh = await this.scope(input.operation, readPermissions(input, await this.principal()))
                if (scopeFingerprint(scope) !== scopeFingerprint(fresh)) throw new AuthError(403, "Read scope changed")
                result = rows.slice(read.resultOffset).map((row) => ({ status: "OK", time: "0ns", result: row }))
              }
            }
            break
          }
          default:
            throw new AuthError(403, "RPC method is not available")
        }
        await this.scope()
        this.send({ id: rpc.id, result })
      } catch (error) {
        // Query and validation diagnostics can contain hidden values; never forward them.
        this.send({
          id: rpc.id,
          error: {
            code: -32602,
            message: error instanceof AuthError ? "Access denied" : "Invalid observation request",
          },
        })
      }
    })
  }
  private async refresh(): Promise<void> {
    await this.scope()
    // Fixed cadence, independent of record changes. No database records or activity signals are pushed.
    for (const id of this.subscriptions.values())
      this.send({
        result: {
          id,
          action: "UPDATE",
          record: new RecordId("observation", "refresh"),
          result: { __observation_refresh: true },
        },
      })
  }
}
