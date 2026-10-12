import { trimQuery } from "./task-search"
import { buildIndexedTaskSearch, buildIndexedWorkflowSearch } from "./indexed-search"

export interface ExplorerFilters {
  mode: "tasks" | "workflows"
  query: string
  states: string[]
  types: string[]
  workers: string[]
  workflowStates: string[]
  rootTypes: string[]
  sortField: string
  sortDirection: "ASC" | "DESC"
}

const TASK_SORT_FIELDS = new Set(["last_updated", "state", "type", "worker", "runtime", "sent_at", "started_at"])
const WORKFLOW_SORT_FIELDS = new Set([
  "last_updated",
  "aggregate_state",
  "root_task_type",
  "task_count",
  "failure_count",
  "active_count",
  "worker_count",
])

function appendCondition(clause: string, condition: string): string {
  return `${clause} AND ${condition}`
}

function buildTaskWhereClause(state: ExplorerFilters): {
  prelude: string[]
  source: string
  clause: string
  bindings: Record<string, unknown>
} {
  const conditions = ["last_updated >= <datetime>$from", "last_updated <= <datetime>$to"]
  const bindings: Record<string, unknown> = {}
  let source = "task"
  let prelude: string[] = []
  const trimmedQuery = trimQuery(state.query)

  if (trimmedQuery) {
    const search = buildIndexedTaskSearch(trimmedQuery)
    source = search.source
    prelude = search.prelude
    conditions.push(`(${search.clause})`)
    Object.assign(bindings, search.bindings)
  }
  if (state.states.length > 0) {
    conditions.push("state IN $states")
    bindings.states = state.states
  }
  if (state.types.length > 0) {
    conditions.push("type IN $types")
    bindings.types = state.types
  }
  if (state.workers.length > 0) {
    conditions.push("worker IN $workers")
    bindings.workers = state.workers
  }

  return { source, prelude, clause: ` WHERE ${conditions.join(" AND ")}`, bindings }
}

function buildWorkflowWhereClause(state: ExplorerFilters): {
  prelude: string[]
  source: string
  clause: string
  bindings: Record<string, unknown>
} {
  const conditions = ["last_updated >= <datetime>$from", "last_updated <= <datetime>$to"]
  const bindings: Record<string, unknown> = {}
  let source = "workflow"
  const trimmedQuery = trimQuery(state.query)
  let prelude: string[] = []

  if (trimmedQuery) {
    const search = buildIndexedWorkflowSearch(trimmedQuery)
    source = search.source
    prelude = search.prelude
    conditions.push(`(${search.clause})`)
    Object.assign(bindings, search.bindings)
  }
  if (state.workflowStates.length > 0) {
    conditions.push("aggregate_state IN $workflowStates")
    bindings.workflowStates = state.workflowStates
  }
  if (state.rootTypes.length > 0) {
    conditions.push("root_task_type IN $rootTypes")
    bindings.rootTypes = state.rootTypes
  }

  return { source, prelude, clause: ` WHERE ${conditions.join(" AND ")}`, bindings }
}

export function buildExplorerQuery(
  state: ExplorerFilters,
  time: { from: string; to: string; bucketDuration: string },
  rowLimit: number,
) {
  const { prelude, source, clause, bindings } =
    state.mode === "tasks" ? buildTaskWhereClause(state) : buildWorkflowWhereClause(state)
  const allowed = state.mode === "tasks" ? TASK_SORT_FIELDS : WORKFLOW_SORT_FIELDS
  const sort = allowed.has(state.sortField) ? state.sortField : "last_updated"
  const rowSql = `SELECT * FROM ${source}${clause} ORDER BY ${sort} ${state.sortDirection} LIMIT $rowLimit`
  const sql =
    prelude.join("") +
    rowSql +
    ";" +
    `SELECT count() AS count FROM ${source}${clause} GROUP ALL;` +
    (state.mode === "tasks"
      ? `SELECT state, count() AS count FROM ${source}${clause} GROUP BY state;` +
        `SELECT type, count() AS count FROM ${source}${appendCondition(clause, "type != NONE")} GROUP BY type;` +
        `SELECT worker, count() AS count FROM ${source}${appendCondition(clause, "worker != NONE")} GROUP BY worker;` +
        `SELECT time::format(time::floor(last_updated, <duration>$bucketDuration), '%Y-%m-%dT%H:%M') AS bucket, state, count() AS count FROM ${source}${clause} GROUP BY bucket, state ORDER BY bucket ASC;`
      : `SELECT aggregate_state, count() AS count FROM ${source}${clause} GROUP BY aggregate_state;` +
        `SELECT root_task_type, count() AS count FROM ${source}${appendCondition(clause, "root_task_type != NONE")} GROUP BY root_task_type;` +
        `SELECT time::format(time::floor(last_updated, <duration>$bucketDuration), '%Y-%m-%dT%H:%M') AS bucket, aggregate_state, count() AS count FROM ${source}${clause} GROUP BY bucket, aggregate_state ORDER BY bucket ASC;`)
  return {
    sql,
    bindings: { ...time, ...bindings, rowLimit },
    preludeCount: prelude.length,
    rowPlanSql: prelude.join("") + rowSql + " EXPLAIN;",
  }
}
