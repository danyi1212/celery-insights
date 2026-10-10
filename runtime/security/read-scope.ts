import { z } from "zod"
import type { Surreal } from "surrealdb"
import { AuthError, grants, type Permission, type Principal } from "./permissions"

export const payloadActions = [
  "task.input.read",
  "task.result.read",
  "task.failure.read",
  "event.raw.read",
  "worker.inspect.read",
] as const
const selectors = z.array(z.string().min(1).max(256)).max(100)
export const readScopeSchema = z
  .object({
    task_ids: selectors.optional(),
    task_types: selectors.optional(),
    task_workers: selectors.optional(),
    worker_hostnames: selectors.optional(),
    deny_fields: z.array(z.enum(payloadActions)).max(5).default([]),
  })
  .strict()
export type ReadScope = z.infer<typeof readScopeSchema>
export const emptyScope = (): ReadScope => ({ deny_fields: [] })
export const rowScoped = (scope: ReadScope) =>
  [scope.task_ids, scope.task_types, scope.task_workers, scope.worker_hostnames].some((value) => value !== undefined)
export const taskScoped = (scope: ReadScope) =>
  [scope.task_ids, scope.task_types, scope.task_workers].some((value) => value !== undefined)
export const restricted = (scope: ReadScope) => rowScoped(scope) || scope.deny_fields.length > 0
export function intersectScopes(a: ReadScope, b: ReadScope): ReadScope {
  const result = emptyScope()
  for (const key of ["task_ids", "task_types", "task_workers", "worker_hostnames"] as const) {
    const left = a[key],
      right = b[key]
    if (left !== undefined || right !== undefined)
      result[key] =
        left === undefined ? right : right === undefined ? left : left.filter((value) => right.includes(value))
  }
  result.deny_fields = [...new Set([...a.deny_fields, ...b.deny_fields])]
  return result
}
export function principalScope(principal: Principal, scope: ReadScope): ReadScope {
  const allowed = grants(principal)
  return intersectScopes(scope, { deny_fields: payloadActions.filter((action) => !allowed.has(action)) })
}
export function scopeFingerprint(scope: ReadScope): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(scope)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, [...value].sort()]),
    ),
  )
}
export function requireUnrestricted(scope: ReadScope, actions: readonly Permission[]): void {
  if (
    restricted(scope) &&
    actions.some((action) =>
      ["diagnostics.export", "backup.import", "history.clear", "retention.update", "cleanup.run"].includes(action),
    )
  )
    throw new AuthError(403, "Operation requires unrestricted observation access")
}

/** Only server-owned queries cross this boundary; clients send validated operation names, never SQL. */
export function scopedDatabase(db: Pick<Surreal, "query">, scope: ReadScope): Pick<Surreal, "query"> {
  if (!restricted(scope)) return db
  const denied = new Set(scope.deny_fields)
  const bindings: Record<string, unknown> = {}
  const taskConditions: string[] = []
  for (const [key, expression] of [
    ["task_ids", "record::id(id)"],
    ["task_types", "type"],
    ["task_workers", "worker"],
  ] as const) {
    if (scope[key] !== undefined) {
      bindings[`__scope_${key}`] = scope[key]
      taskConditions.push(`${expression} IN $__scope_${key}`)
    }
  }
  const taskWhere = taskConditions.length ? taskConditions.join(" AND ") : "true"
  const taskMetadata =
    "id,type,state,sent_at,received_at,started_at,succeeded_at,failed_at,retried_at,revoked_at,rejected_at,runtime,last_updated,first_observed_at,had_error,eta,expires,retries,exchange,routing_key,worker"
  const taskFields = [
    taskMetadata,
    ...(!taskScoped(scope) ? ["root_id,parent_id,workflow_id,children"] : ["[] AS children"]),
    ...(!denied.has("task.input.read") ? ["args,kwargs"] : []),
    ...(!denied.has("task.result.read") ? ["result,result_truncated"] : []),
    ...(!denied.has("task.failure.read") ? ["exception,traceback"] : []),
  ].join(",")
  bindings.__scope_worker_hostnames = scope.worker_hostnames ?? []
  const sources: Record<string, string> = {
    task: `(SELECT ${taskFields} FROM task WHERE ${taskWhere})`,
    // Omit cross-task workflow summaries entirely when task visibility is constrained.
    workflow: `(SELECT id,root_task_id,root_task_type,aggregate_state,first_seen_at,last_updated,task_count,completed_count,failure_count,retry_count,active_count,worker_count${denied.has("task.failure.read") ? "" : ",latest_exception_preview"} FROM workflow WHERE ${taskScoped(scope) ? "false" : "true"})`,
    workflow_task: `(SELECT * FROM workflow_task WHERE ${taskScoped(scope) ? "false" : "true"})`,
    worker: `(SELECT id,hostname,pid,software_identity,software_version,software_sys,last_updated,heartbeat_expires,cpu_load,status,missed_polls${!rowScoped(scope) ? ",active_tasks,processed_tasks" : ""}${!denied.has("worker.inspect.read") && !restricted(scope) ? ",inspect" : ""} FROM worker${scope.worker_hostnames !== undefined ? " WHERE record::id(id) IN $__scope_worker_hostnames" : ""})`,
    event: `(SELECT ${!restricted(scope) && !denied.has("event.raw.read") ? "*" : "id,event_type,task_id,timestamp,hostname"} FROM event${taskScoped(scope) ? ` WHERE task_id IN (SELECT VALUE record::id(id) FROM task WHERE ${taskWhere})` : ""})`,
  }
  return {
    query: ((sql: string, parameters: Record<string, unknown> = {}) => {
      if (typeof sql !== "string" || Object.keys(parameters).some((key) => key.startsWith("__scope_")))
        throw new AuthError(403, "Invalid observation operation")
      // Exact source replacement in trusted application queries, not a user SQL parser.
      const transformed = sql.replace(
        /\bFROM\s+(type::record\('(task|worker|workflow|event)',\s*(\$[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\)|\$searchTasks\b|\$searchWorkflowRows\b|workflow_task\b|workflow\b|worker\b|event\b|task\b)/g,
        (_match, source: string, table?: string, id?: string) =>
          table
            ? `FROM (SELECT * FROM ${sources[table]} WHERE id = type::record('${table}', ${id}))`
            : source === "$searchTasks"
              ? `FROM ${sources.task.replace("FROM task", "FROM $searchTasks")}`
              : source === "$searchWorkflowRows"
                ? `FROM ${sources.workflow.replace("FROM workflow", "FROM $searchWorkflowRows")}`
                : `FROM ${sources[source]}`,
      )
      return db.query(transformed, { ...parameters, ...bindings })
    }) as Surreal["query"],
  }
}
