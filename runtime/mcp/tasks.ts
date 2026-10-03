import { Queries, Results, ToolError, type Row, number, object, plainId } from "./common"
import { taskFields, taskRow } from "./workflows"

const payloadFields = { input: ["args", "kwargs"], output: ["result"], error: ["exception", "traceback"] } as const
const textField = (value: unknown, sourceTruncated: unknown, truncated: boolean): Row => ({
  availability: typeof value === "string" ? "available" : "unavailable",
  format: "text",
  text: typeof value === "string" ? value : null,
  response_truncated: truncated,
  source_truncated: typeof sourceTruncated === "boolean" ? sourceTruncated : null,
})

export class TaskTools {
  constructor(
    private readonly q: Queries,
    private readonly r: Results,
    private readonly now: number,
  ) {}
  async inspect(position: unknown): Promise<Row> {
    const scope = this.r.scope
    scope.section ??= "overview"
    if (scope.section !== "history" && scope.limit)
      throw new ToolError("invalid_arguments", "limit is valid only for task history.")
    const bindings: Row = { taskId: scope.task_id }
    const task = await this.q.one(
      "SELECT record::id(id) AS task_id, type AS name, state, worker, workflow_id FROM type::record('task', $taskId)",
      bindings,
    )
    task.task_id = plainId(task.task_id)
    task.name ??= null
    task.worker ??= null
    task.workflow_id ??= null
    const base = { ...this.r.base(), task }
    if (scope.section === "overview") {
      if (position) throw new ToolError("invalid_arguments", "overview does not accept pagination.")
      const raw = await this.q.one(
        `SELECT ${taskFields}, eta, expires, exchange, routing_key, last_updated, result_truncated,
        IF args != NONE THEN string::slice(args, 0, 512) ELSE NONE END AS args_preview, string::len(args ?? '') AS args_length,
        IF kwargs != NONE THEN string::slice(kwargs, 0, 512) ELSE NONE END AS kwargs_preview, string::len(kwargs ?? '') AS kwargs_length,
        IF result != NONE THEN string::slice(result, 0, 512) ELSE NONE END AS result_preview, string::len(result ?? '') AS result_length,
        IF traceback != NONE THEN string::slice(traceback, -1024) ELSE NONE END AS traceback_excerpt, string::len(traceback ?? '') AS traceback_length
        FROM type::record('task', $taskId)`,
        bindings,
      )
      return this.r.finish({
        ...base,
        task: {
          ...task,
          ...taskRow(raw, this.now),
          eta: raw.eta ?? null,
          expires: raw.expires ?? null,
          exchange: raw.exchange ?? null,
          routing_key: raw.routing_key ?? null,
          last_updated: raw.last_updated,
        },
        input: {
          args: textField(raw.args_preview, null, number(raw.args_length) > 512),
          kwargs: textField(raw.kwargs_preview, null, number(raw.kwargs_length) > 512),
          section: "input",
        },
        output: {
          result: textField(raw.result_preview, raw.result_truncated, number(raw.result_length) > 512),
          section: "output",
        },
        error: {
          exception_preview: raw.exception_preview ?? null,
          traceback_excerpt: textField(raw.traceback_excerpt, null, number(raw.traceback_length) > 1024),
          section: "error",
        },
      })
    }
    if (scope.section === "history") {
      scope.limit ??= 10
      const total = await this.q.count("event", "task_id = $taskId", bindings)
      const after = object(position)
      let where = "task_id = $taskId"
      if (position) {
        where +=
          " AND (timestamp > <datetime>$afterTime OR (timestamp = <datetime>$afterTime AND id > type::record('event', $afterId)))"
        bindings.afterTime = after.timestamp
        bindings.afterId = after.event_id
      }
      bindings.pageLimit = number(scope.limit) + 1
      const events = await this.q.rows(
        `SELECT record::id(id) AS event_id, event_type, timestamp, hostname AS worker, string::slice(exception ?? '', 0, 512) AS exception_preview FROM event WHERE ${where} ORDER BY timestamp, event_id LIMIT $pageLimit`,
        bindings,
      )
      return this.r.page(base, "events", events, total, number(scope.limit), (row) => ({
        timestamp: row.timestamp,
        event_id: row.event_id,
      }))
    }
    const fields = payloadFields[scope.section as keyof typeof payloadFields]
    const anchor = object(position)
    let fieldIndex = number(anchor.field_index)
    let offset = number(anchor.offset)
    const chunks: Row = {}
    const lengths = await this.q.one(
      `SELECT ${fields.map((field) => `string::len(${field} ?? '') AS ${field}_length, ${field} != NONE AS ${field}_available`).join(", ")}, result_truncated FROM type::record('task', $taskId)`,
      bindings,
    )
    const extra: Row = {}
    if (scope.section === "error" && !position) {
      const [excerpt] = await this.q.rows(
        "SELECT IF traceback != NONE THEN string::slice(traceback, -1024) ELSE NONE END AS text FROM type::record('task', $taskId)",
        bindings,
      )
      extra.traceback_excerpt = textField(excerpt?.text, null, number(lengths.traceback_length) > 1024)
    }
    // 2048 Unicode characters fit in 8 KiB even for four-byte code points.
    let remaining = scope.section === "error" && !position ? 1024 : 2048
    while (fieldIndex < fields.length && remaining > 0) {
      const field = fields[fieldIndex]
      const length = number(lengths[`${field}_length`])
      if (!lengths[`${field}_available`]) {
        chunks[field] = textField(null, null, false)
        fieldIndex++
        offset = 0
        continue
      }
      const amount = Math.min(remaining, Math.max(0, length - offset))
      const [slice] = await this.q.rows(
        `SELECT string::slice(${field}, $offset, $endOffset) AS text FROM type::record('task', $taskId)`,
        { ...bindings, offset, endOffset: offset + amount },
      )
      chunks[field] = {
        ...textField(slice?.text ?? "", field === "result" ? lengths.result_truncated : null, offset + amount < length),
        offset,
      }
      remaining -= amount
      offset += amount
      if (offset >= length) {
        fieldIndex++
        offset = 0
      } else break
    }
    const hasMore = fieldIndex < fields.length
    return this.r.finish({
      ...base,
      fields: chunks,
      ...extra,
      has_more: hasMore,
      next_cursor: hasMore ? this.r.cursors.encode(this.r.tool, scope, { field_index: fieldIndex, offset }) : null,
    })
  }
}
