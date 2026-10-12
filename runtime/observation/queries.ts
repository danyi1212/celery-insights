import { z } from "zod"
import { trimQuery } from "../../src/lib/task-search"
import { buildIndexedTaskSearch, buildIndexedWorkflowSearch } from "../../src/lib/indexed-search"
import { RecordId } from "surrealdb"
import { grants, type Permission, type Principal } from "../security/permissions"

export const operations = [
  "list",
  "export",
  "explorer",
  "events",
  "search",
  "home",
  "analytics",
  "exceptions",
  "task-workflow",
  "counts",
] as const
const names = z.array(z.string().max(256)).max(100).default([])
export const readRequestSchema = z
  .object({
    operation: z.enum(operations),
    table: z.enum(["task", "worker", "workflow", "event"]).default("task"),
    id: z.string().min(1).max(256).optional(),
    taskId: z.string().max(256).optional(),
    workerId: z.string().max(256).optional(),
    workflowId: z.string().max(256).optional(),
    workflowIds: names,
    type: z.string().max(256).optional(),
    states: names,
    types: names,
    workers: names,
    workflowStates: names,
    rootTypes: names,
    query: z.string().max(256).default(""),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    bucketDuration: z
      .string()
      .regex(/^[1-9]\d{0,6}(?:s|m|h|d)$/)
      .default("600s"),
    sortField: z
      .enum([
        "last_updated",
        "state",
        "type",
        "worker",
        "runtime",
        "sent_at",
        "started_at",
        "aggregate_state",
        "root_task_type",
        "task_count",
        "failure_count",
        "active_count",
        "worker_count",
      ])
      .default("last_updated"),
    sortDirection: z.enum(["ASC", "DESC"]).default("DESC"),
    limit: z.number().int().min(1).max(10000).default(100),
    offset: z.number().int().min(0).max(1000000000).default(0),
    failure: z.boolean().default(false),
    online: z.boolean().default(false),
  })
  .strict()
  .refine((value) => Boolean(value.from) === Boolean(value.to), { message: "Both time bounds are required" })
export type ReadRequest = z.input<typeof readRequestSchema>
export function readPermissions(input: ReadRequest, principal?: Principal): Permission[] {
  const required = operationPermissions(input)
  if (!principal) return required
  const table = ["home", "analytics", "exceptions", "task-workflow"].includes(input.operation)
    ? "task"
    : input.operation === "events"
      ? "event"
      : (input.table ?? "task")
  const payloads: Permission[] =
    input.operation === "search"
      ? ["task.input.read", "task.result.read", "task.failure.read", "worker.inspect.read"]
      : ["list", "explorer", "export", "task-workflow"].includes(input.operation)
        ? table === "task"
          ? ["task.input.read", "task.result.read", "task.failure.read"]
          : table === "worker"
            ? ["worker.inspect.read"]
            : table === "event"
              ? ["event.raw.read"]
              : input.query
                ? ["task.input.read", "task.result.read", "task.failure.read"]
                : ["task.failure.read"]
        : []
  const allowed = grants(principal)
  return [...new Set([...required, ...payloads.filter((action) => allowed.has(action))])]
}
function operationPermissions(input: ReadRequest): Permission[] {
  if (input.operation === "export") return ["task.export", ...operationPermissions({ ...input, operation: "list" })]
  if (input.operation === "search") return ["task.metadata.read", "worker.metadata.read"]
  if (input.operation === "counts" || input.operation === "home" || input.operation === "analytics")
    return ["analytics.read"]
  if (input.operation === "task-workflow") return ["task.metadata.read"]
  if (input.operation === "exceptions") return ["task.metadata.read", "task.failure.read"]
  if (input.table === "event" || input.operation === "events") return ["task.metadata.read", "event.raw.read"]
  if (input.table === "worker") return ["worker.metadata.read"]
  return ["task.metadata.read"]
}

/** Fixed server-owned projections and predicates. All caller values become bindings. */
export function buildRead(input: ReadRequest): {
  sql: string
  bindings: Record<string, unknown>
  resultOffset: number
} {
  const read = compileRead(input)
  // Only fixed catalogue statements contain SQL; caller values are bindings.
  read.sql = read.sql
    .split(";")
    .map((statement) =>
      statement.trimStart().startsWith("SELECT ") && !statement.includes("TIMEOUT")
        ? statement + " TIMEOUT 2s"
        : statement,
    )
    .join(";")
  // LET slots are internal candidate sets; expose only the operation's result sets.
  const resultOffset = read.sql.split(";").findIndex((statement) => !statement.trimStart().startsWith("LET "))
  return { ...read, resultOffset: Math.max(0, resultOffset) }
}
function compileRead(input: ReadRequest): { sql: string; bindings: Record<string, unknown> } {
  const p = readRequestSchema.parse(input)
  const bindings: Record<string, unknown> = { ...p, q: p.query.toLowerCase(), taskName: p.type }
  const table = p.operation === "events" ? "event" : p.table
  const conditions: string[] = []
  const time = table === "event" ? "timestamp" : "last_updated"
  if (p.from && p.to) conditions.push(`${time} >= <datetime>$from`, `${time} <= <datetime>$to`)
  if (p.id) {
    bindings.rid = new RecordId(table, p.id)
    conditions.push("id = $rid")
  }
  if (p.taskId) conditions.push("task_id = $taskId")
  if (p.workerId) conditions.push("worker = $workerId")
  if (p.workflowId) conditions.push("workflow_id = $workflowId")
  if (p.workflowIds.length) conditions.push("workflow_id IN $workflowIds")
  if (p.type) conditions.push("type = $type")
  if (p.failure) conditions.push("(state = 'FAILURE' OR exception != NONE)")
  if (p.online) conditions.push("status = 'online'")
  for (const [field, key] of (table === "task"
    ? [
        ["state", "states"],
        ["type", "types"],
        ["worker", "workers"],
      ]
    : table === "workflow"
      ? [
          ["aggregate_state", "workflowStates"],
          ["root_task_type", "rootTypes"],
        ]
      : [["event_type", "types"]]) as [string, "states" | "types" | "workers" | "workflowStates" | "rootTypes"][]) {
    if (p[key].length) conditions.push(`${field} IN $${key}`)
  }
  let prelude: string[] = []
  let source: string = table
  if (
    trimQuery(p.query) &&
    !["search", "home", "analytics", "exceptions", "task-workflow", "counts"].includes(p.operation)
  ) {
    if (table === "task" || table === "workflow") {
      const search = table === "task" ? buildIndexedTaskSearch(p.query) : buildIndexedWorkflowSearch(p.query)
      prelude = search.prelude
      source = search.source
      conditions.push(`(${search.clause})`)
      Object.assign(bindings, search.bindings)
    } else {
      conditions.push(
        "(" +
          ["event_type", "task_id", "hostname", "data"]
            .map((field) => `string::contains(string::lowercase(string::concat('', ${field} ?? '')), $q)`)
            .join(" OR ") +
          ")",
      )
    }
  }
  const where = (extra?: string) =>
    [...conditions, ...(extra ? [extra] : [])].length
      ? ` WHERE ${[...conditions, ...(extra ? [extra] : [])].join(" AND ")}`
      : ""
  const sortFields =
    table === "task"
      ? ["last_updated", "state", "type", "worker", "runtime", "sent_at", "started_at"]
      : table === "workflow"
        ? [
            "last_updated",
            "aggregate_state",
            "root_task_type",
            "task_count",
            "failure_count",
            "active_count",
            "worker_count",
          ]
        : ["last_updated"]
  const sort = table === "event" ? "timestamp" : sortFields.includes(p.sortField) ? p.sortField : "last_updated"
  const select = `SELECT * FROM ${source}${where()} ORDER BY ${sort} ${p.sortDirection} LIMIT $limit START $offset TIMEOUT 2s;`
  const count = `SELECT count() AS count FROM ${source}${where()} GROUP ALL TIMEOUT 2s;`
  if (p.operation === "list" || p.operation === "export") return { sql: prelude.join("") + select, bindings }
  if (p.operation === "explorer") {
    const fields = table === "workflow" ? ["aggregate_state", "root_task_type"] : ["state", "type", "worker"]
    return {
      sql:
        prelude.join("") +
        select +
        count +
        fields
          .map(
            (field) =>
              `SELECT ${field}, count() AS count FROM ${source}${where(`${field} != NONE`)} GROUP BY ${field};`,
          )
          .join("") +
        `SELECT time::format(time::floor(last_updated, <duration>$bucketDuration), '%Y-%m-%dT%H:%M') AS bucket, ${fields[0]}, count() AS count FROM ${source}${where()} GROUP BY bucket, ${fields[0]} ORDER BY bucket ASC;`,
      bindings,
    }
  }
  if (p.operation === "events")
    return {
      sql:
        select +
        count +
        `SELECT event_type, count() AS count FROM event${where()} GROUP BY event_type;SELECT time::format(time::floor(timestamp, <duration>$bucketDuration), '%Y-%m-%dT%H:%M') AS bucket, count() AS count FROM event${where()} GROUP BY bucket ORDER BY bucket ASC;`,
      bindings,
    }
  if (p.operation === "search") {
    const search = buildIndexedTaskSearch(p.query)
    Object.assign(bindings, search.bindings)
    return {
      sql:
        search.prelude.join("") +
        `SELECT *, (SELECT root_task_type,aggregate_state,task_count FROM workflow WHERE id = type::record('workflow', workflow_id))[0] AS workflow FROM ${search.source} WHERE (${search.clause}) ORDER BY last_updated DESC LIMIT $limit;SELECT * FROM worker WHERE string::contains(string::lowercase(string::concat('',id)),$q) ORDER BY last_updated DESC LIMIT $limit;`,
      bindings,
    }
  }
  if (p.operation === "counts")
    return {
      sql: "SELECT count() AS count FROM task GROUP ALL;SELECT count() AS count FROM event GROUP ALL;SELECT count() AS count FROM worker GROUP ALL;",
      bindings,
    }
  if (p.operation === "exceptions")
    return {
      sql: "SELECT exception,count() AS count FROM task WHERE exception != NONE GROUP BY exception ORDER BY count DESC;",
      bindings,
    }
  if (p.operation === "task-workflow")
    return {
      sql: `LET $task = (SELECT * FROM type::record('task',$taskId) TIMEOUT 2s)[0];LET $workflowId = $task.workflow_id ?? $task.root_id ?? $taskId;RETURN {task:$task,workflow:(SELECT * FROM type::record('workflow',$workflowId) TIMEOUT 2s)[0],members:SELECT * FROM task WHERE workflow_id = $workflowId ORDER BY last_updated DESC LIMIT 1000 TIMEOUT 2s};`,
      bindings,
    }
  if (p.operation === "home")
    return {
      sql: `SELECT count() AS recent_task_count FROM task WHERE last_updated > time::now() - 3600s GROUP ALL;SELECT count() AS recent_failure_count FROM task WHERE last_updated > time::now() - 3600s AND (state = 'FAILURE' OR exception != NONE) GROUP ALL;SELECT last_updated FROM task ORDER BY last_updated DESC LIMIT 1;SELECT time::format(time::floor(last_updated,600s),'%Y-%m-%dT%H:%M:%SZ') AS bucket,count() AS count FROM task WHERE last_updated > time::now() - 3600s GROUP BY bucket ORDER BY bucket ASC;SELECT time::format(time::floor(last_updated,600s),'%Y-%m-%dT%H:%M:%SZ') AS bucket,count() AS count FROM task WHERE last_updated > time::now() - 3600s AND (state = 'FAILURE' OR exception != NONE) GROUP BY bucket ORDER BY bucket ASC;`,
      bindings,
    }
  return {
    sql: `SELECT time::format(time::floor(last_updated,<duration>$bucketDuration),'%Y-%m-%dT%H:%M') AS bucket,count() AS count FROM task${where()} GROUP BY bucket ORDER BY bucket ASC;SELECT time::format(time::floor(last_updated,<duration>$bucketDuration),'%Y-%m-%dT%H:%M') AS bucket,math::sum(IF state='SUCCESS' THEN 1 ELSE 0 END) AS success,math::sum(IF state='FAILURE' THEN 1 ELSE 0 END) AS failure,count() AS total,math::sum(IF state='FAILURE' THEN 1 ELSE 0 END)/count()*100 AS failure_rate FROM task${where("state IN ['SUCCESS','FAILURE']")} GROUP BY bucket ORDER BY bucket ASC;SELECT type,math::mean(runtime) AS avg_runtime,math::min(runtime) AS min_runtime,math::max(runtime) AS max_runtime,count() AS count FROM task${where("runtime != NONE AND type != NONE")} GROUP BY type ORDER BY count DESC LIMIT 15;SELECT worker,count() AS count FROM task${where("worker != NONE")} GROUP BY worker ORDER BY worker;`,
    bindings,
  }
}
