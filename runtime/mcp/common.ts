import { createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod"
import { DateTime, QueryError, type Surreal } from "surrealdb"

export const MAX_RESPONSE_BYTES = 24 * 1024
export const TERMINAL_STATES = ["SUCCESS", "FAILURE", "REVOKED", "REJECTED"]
export const ERROR_EVIDENCE =
  "(had_error = true OR state = 'FAILURE' OR failed_at != NONE OR (exception ?? '') != '' OR (traceback ?? '') != '')"
export const INVOCATION_TIME = "(sent_at ?? first_observed_at ?? last_updated)"
export const textSelector = z.string().trim().min(1).max(512)
const cursor = z.string().min(1).max(8192).optional()
const limit = (max: number) => z.number().int().min(1).max(max).optional()
const inputSchemas = {
  search_workflows: z
    .object({
      task_name: textSelector.optional(),
      worker: textSelector.optional(),
      within: z
        .string()
        .regex(/^(all|[1-9]\d{0,5}[mhd])$/)
        .optional(),
      status: z.enum(["all", "running", "finished"]).optional(),
      has_errors: z.boolean().optional(),
      limit: limit(20),
      cursor,
    })
    .strict(),
  inspect_workflow: z
    .object({
      workflow_id: textSelector,
      view: z.enum(["overview", "tasks", "task_names"]).optional(),
      parent_task_id: textSelector.optional(),
      task_name: textSelector.optional(),
      limit: limit(100),
      cursor,
    })
    .strict(),
  inspect_task: z
    .object({
      task_id: textSelector,
      section: z.enum(["overview", "input", "output", "error", "history"]).optional(),
      limit: limit(50),
      cursor,
    })
    .strict(),
  list_workers: z
    .object({
      hostname: textSelector.optional(),
      task_name: textSelector.optional(),
      status: z.enum(["all", "online", "offline"]).optional(),
      limit: limit(50),
      cursor,
    })
    .strict(),
  inspect_worker: z
    .object({
      hostname: textSelector,
      section: z.enum(["overview", "activity", "registered", "queues"]).optional(),
      task_name: textSelector.optional(),
      limit: limit(100),
      cursor,
    })
    .strict(),
}
// Compile final server schemas once; browser validation is unaffected.
export const schemas = {
  search_workflows: z.compile(inputSchemas.search_workflows),
  inspect_workflow: z.compile(inputSchemas.inspect_workflow),
  inspect_task: z.compile(inputSchemas.inspect_task),
  list_workers: z.compile(inputSchemas.list_workers),
  inspect_worker: z.compile(inputSchemas.inspect_worker),
}
export type ToolName = keyof typeof schemas
export type Row = Record<string, unknown>
export type Mode = "live" | "snapshot" | "ingestion_disabled"
export class ToolError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause })
  }
}
export const plainId = (id: unknown): string => {
  // Query projections use record::id; this fallback is only for record wrappers.
  if (typeof id === "string") return id
  const value = String(id)
  return value.slice(value.indexOf(":") + 1).replace(/^[⟨<]|[⟩>]$/g, "")
}
export const iso = (value: unknown): string | null =>
  value instanceof Date || value instanceof DateTime
    ? value.toISOString()
    : typeof value === "string" && value
      ? value
      : null
export const short = (value: unknown, size = 512): string | null =>
  typeof value === "string" ? value.slice(0, size) : null
export const number = (value: unknown): number => (typeof value === "number" ? value : 0)
export const object = (value: unknown): Row =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {}
export const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
export const contains = (value: unknown, term: unknown): boolean =>
  typeof term !== "string" || (typeof value === "string" && value.toLowerCase().includes(term.toLowerCase()))
export const utf8Size = (value: unknown): number => Buffer.byteLength(JSON.stringify(value))

interface CursorData {
  tool: ToolName
  scope: Row
  position: unknown
  expires: number
}
export class Cursors {
  constructor(
    private readonly secret: string,
    private readonly now: () => number = Date.now,
  ) {}
  encode(tool: ToolName, scope: Row, position: unknown): string {
    const body = Buffer.from(JSON.stringify({ tool, scope, position, expires: this.now() + 15 * 60_000 })).toString(
      "base64url",
    )
    return `${body}.${createHmac("sha256", this.secret).update(body).digest("base64url")}`
  }
  resolve(tool: ToolName, input: Row): { scope: Row; position: unknown } {
    if (!input.cursor) return { scope: input, position: null }
    try {
      const [body, signature, extra] = String(input.cursor).split(".")
      const expected = createHmac("sha256", this.secret).update(body).digest()
      const actual = Buffer.from(signature, "base64url")
      if (extra || expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error("signature")
      const data = JSON.parse(Buffer.from(body, "base64url").toString()) as CursorData
      if (data.tool !== tool) throw new Error("tool")
      if (data.expires < this.now())
        throw new ToolError("cursor_expired", "Restart the original query; this cursor has expired.")
      for (const [key, value] of Object.entries(input)) {
        if (key !== "cursor" && JSON.stringify(data.scope[key]) !== JSON.stringify(value)) throw new Error("scope")
      }
      return { scope: data.scope, position: data.position }
    } catch (error) {
      if (error instanceof ToolError) throw error
      throw new ToolError("invalid_cursor", "Invalid cursor or conflicting selectors; restart the original query.")
    }
  }
}

export class Queries {
  private readonly deadline = Date.now() + 10_000
  constructor(private readonly db: Pick<Surreal, "query">) {}
  async rows(sql: string, bindings: Row = {}): Promise<Row[]> {
    if (Date.now() >= this.deadline)
      throw new ToolError("query_budget_exceeded", "Narrow the task name, worker, or time window.")
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const results = await Promise.race([
        this.db.query<[Row[]]>(`${sql} TIMEOUT 2s`, bindings).collect(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new ToolError(
                  "query_budget_exceeded",
                  "Inspection timed out; narrow the selection or retry when the database is available.",
                ),
              ),
            Math.max(1, this.deadline - Date.now()),
          )
        }),
      ])
      return Array.isArray(results[0]) ? results[0] : []
    } catch (error) {
      if (error instanceof ToolError) throw error
      if (error instanceof QueryError && (error.isTimedOut || error.isCancelled))
        throw new ToolError("query_budget_exceeded", "Narrow the task name, worker, or time window.", error)
      throw new ToolError(
        "unavailable",
        "SurrealDB query failed; no conclusion about matching tasks can be drawn.",
        error,
      )
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
  async one(sql: string, bindings: Row = {}): Promise<Row> {
    const row = (await this.rows(sql, bindings))[0]
    if (!row) throw new ToolError("not_found", "Record not observed or no longer retained.")
    return row
  }
  async count(table: "task" | "worker" | "event", where: string, bindings: Row): Promise<number> {
    return number(
      (await this.rows(`SELECT count() AS total FROM ${table} WHERE ${where} GROUP ALL`, bindings))[0]?.total,
    )
  }
}

export class Results {
  constructor(
    public readonly tool: ToolName,
    public readonly scope: Row,
    public readonly cursors: Cursors,
    private readonly mode: Mode,
    private readonly now: () => number,
  ) {}
  base(warnings: string[] = []): Row {
    return { meta: { read_at: new Date(this.now()).toISOString(), mode: this.mode, warnings } }
  }
  page(base: Row, key: string, rows: Row[], total: number | null, limit: number, position: (row: Row) => unknown): Row {
    const items = rows.slice(0, limit)
    const make = (): Row => ({
      ...base,
      [key]: items,
      page: {
        returned: items.length,
        total,
        has_more: rows.length > items.length,
        next_cursor:
          rows.length > items.length && items.length
            ? this.cursors.encode(this.tool, this.scope, position(items[items.length - 1]))
            : null,
      },
    })
    while (items.length && utf8Size(make()) > MAX_RESPONSE_BYTES) items.pop()
    if (rows.length && !items.length)
      throw new ToolError("query_budget_exceeded", "A result exceeds the response budget; narrow the selection.")
    return this.finish(make())
  }
  finish(result: Row): Row {
    if (utf8Size(result) > MAX_RESPONSE_BYTES)
      throw new ToolError("query_budget_exceeded", "Response exceeds the budget; request a narrower view.")
    return result
  }
}
