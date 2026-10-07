import { EXECUTION_OBSERVATION_MAX_AGE_MS, getTaskExecution } from "../../src/utils/task-execution"
import {
  ERROR_EVIDENCE,
  INVOCATION_TIME,
  TERMINAL_STATES,
  ToolError,
  Queries,
  Results,
  type Row,
  number,
  object,
  plainId,
  iso,
  short,
  utf8Size,
  MAX_RESPONSE_BYTES,
} from "./common"

export const TASK_FIELDS = `id, record::id(id) AS task_id, type AS name, state, worker,
  workflow_id, parent_id AS parent_task_id, sent_at, first_observed_at, last_updated,
  started_at, execution_active, execution_observed_at, execution_active_at, succeeded_at, failed_at, revoked_at, rejected_at, runtime, retries,
  string::slice(exception ?? '', 0, 512) AS exception_preview,
  (SELECT count() AS total FROM task WHERE parent_id = $parent.task_id OR id IN
    array::map($parent.children ?? [], |$child| type::record('task', $child)) GROUP ALL)[0].total ?? 0 AS observed_child_count,
  IF parent_id != NONE THEN array::len(SELECT id FROM type::record('task', $parent.parent_id)) > 0 ELSE NONE END AS parent_record_available`
// Correlated subqueries refer to the original task record, not projection aliases.
export const taskFields = TASK_FIELDS.replace("$parent.task_id", "record::id($parent.id)")
export const taskRow = (raw: Row, now: number): Row => {
  const invoked = iso(raw.sent_at) ?? iso(raw.first_observed_at) ?? iso(raw.last_updated)
  const started = iso(raw.started_at)
  const finished =
    [raw.succeeded_at, raw.failed_at, raw.revoked_at, raw.rejected_at]
      .map(iso)
      .filter((value): value is string => !!value)
      .sort()
      .at(-1) ?? null
  const terminal = TERMINAL_STATES.includes(String(raw.state))
  return {
    task_id: plainId(raw.task_id),
    name: raw.name ?? null,
    state: raw.state,
    worker: raw.worker ?? null,
    invoked_at: invoked,
    invocation_time_basis: raw.sent_at ? "sent_at" : raw.first_observed_at ? "first_observed_at" : null,
    started_at: started,
    execution_status:
      raw.state === "STARTED"
        ? getTaskExecution(
            {
              execution_active: typeof raw.execution_active === "boolean" ? raw.execution_active : undefined,
              execution_observed_at: iso(raw.execution_observed_at),
              last_updated: iso(raw.last_updated),
            },
            now,
          )
        : null,
    execution_observed_at: iso(raw.execution_observed_at),
    execution_active_at: iso(raw.execution_active_at),
    finished_at: terminal ? finished : null,
    elapsed_seconds:
      terminal && typeof raw.runtime === "number"
        ? raw.runtime
        : started
          ? Math.max(0, ((terminal ? Date.parse(finished ?? started) : now) - Date.parse(started)) / 1000)
          : null,
    retries: raw.retries ?? null,
    parent_task_id: raw.parent_task_id ?? null,
    parent_record_available: raw.parent_record_available ?? null,
    observed_child_count: number(raw.observed_child_count),
    exception_preview: short(raw.exception_preview),
  }
}

const aggregate = `count() AS total,
  math::sum(IF state NOT IN $terminal THEN 1 ELSE 0 END) AS unfinished_count,
  math::sum(IF ${ERROR_EVIDENCE} THEN 1 ELSE 0 END) AS error_task_count,
  math::min(time::unix(first_observed_at ?? sent_at ?? last_updated)) AS first_time,
  math::max(time::unix(last_updated)) AS last_time`
const timestamp = (seconds: unknown) => (typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null)

export class WorkflowTools {
  constructor(
    private readonly q: Queries,
    private readonly r: Results,
    private readonly now: number,
  ) {}
  private async counts(where: string, bindings: Row, max = 8) {
    const groups = await this.q.rows(
      `SELECT type AS name, count() AS count, math::max(IF $taskName != NONE AND string::contains(string::lowercase(type ?? ''), $taskName) THEN 3 ELSE IF ${ERROR_EVIDENCE} THEN 2 ELSE IF state = 'STARTED' THEN 1 ELSE 0 END) AS priority FROM task WHERE ${where} GROUP BY type ORDER BY priority DESC, count DESC, name LIMIT $groupLimit`,
      { taskName: null, ...bindings, groupLimit: max + 1 },
    )
    const total = await this.q.count("task", where, bindings)
    const [groupCount] = await this.q.rows(
      `SELECT count() AS total FROM (SELECT type FROM task WHERE ${where} GROUP BY type) GROUP ALL`,
      bindings,
    )
    return {
      total,
      by_name: groups.slice(0, max).map((row) => ({ name: row.name ?? null, count: number(row.count) })),
      omitted_name_count: Math.max(0, number(groupCount?.total) - max),
    }
  }
  private async summary(workflowId: string, taskName?: unknown): Promise<Row> {
    const bindings = {
      workflowId,
      terminal: TERMINAL_STATES,
      taskName: typeof taskName === "string" ? taskName.toLowerCase() : null,
    }
    const shell = await this.q.one(
      "SELECT root_task_id, root_task_type FROM type::record('workflow', $workflowId)",
      bindings,
    )
    const counts = (
      await this.q.rows(`SELECT ${aggregate} FROM task WHERE workflow_id = $workflowId GROUP ALL`, bindings)
    )[0]
    const total = number(counts?.total)
    return {
      workflow_id: workflowId,
      root_task_id: shell.root_task_id ?? null,
      root_task_name: shell.root_task_type ?? null,
      first_observed_at: timestamp(counts?.first_time),
      last_activity_at: timestamp(counts?.last_time),
      status: total ? (number(counts?.unfinished_count) > 0 ? "running" : "finished") : null,
      has_errors: total ? number(counts?.error_task_count) > 0 : null,
      error_task_count: total ? number(counts?.error_task_count) : null,
      task_counts: await this.counts("workflow_id = $workflowId", bindings),
    }
  }
  private memberMatch(scope: Row, bindings: Row): string {
    const conditions: string[] = []
    if (scope.task_name) {
      conditions.push("string::contains(string::lowercase(type ?? ''), $taskName)")
      bindings.taskName = String(scope.task_name).toLowerCase()
    }
    if (scope.worker) {
      conditions.push("string::contains(string::lowercase(worker ?? ''), $worker)")
      bindings.worker = String(scope.worker).toLowerCase()
    }
    if (scope.task_name || scope.worker) {
      conditions.push(`${INVOCATION_TIME} <= <datetime>$end`)
      if (scope.start) conditions.push(`${INVOCATION_TIME} >= <datetime>$start`)
    }
    return conditions.join(" AND ") || "true"
  }
  async search(position: unknown): Promise<Row> {
    const scope = this.r.scope
    if (!scope.end) {
      const within = String(scope.within ?? "1h")
      const duration =
        within === "all"
          ? null
          : Number(within.slice(0, -1)) * ({ m: 60_000, h: 3_600_000, d: 86_400_000 }[within.at(-1)!] ?? 0)
      if (duration !== null && (!Number.isSafeInteger(duration) || duration > 30 * 86_400_000))
        throw new ToolError("invalid_arguments", "within must be all or a duration between 1 minute and 30 days.")
      scope.start = duration === null ? null : new Date(this.now - duration).toISOString()
      scope.end = new Date(this.now).toISOString()
      scope.status ??= "all"
      scope.within ??= "1h"
      scope.limit ??= 5
    }
    const bindings: Row = { ...scope, terminal: TERMINAL_STATES }
    const member = this.memberMatch(scope, bindings)
    const rank = scope.task_name
      ? "IF string::lowercase(type ?? '') = $taskName THEN 3 ELSE IF array::last(string::split(string::lowercase(type ?? ''), '.')) = $taskName THEN 2 ELSE 1 END"
      : "0"
    const grouped = `SELECT workflow_id, ${aggregate}, math::sum(IF ${member} THEN 1 ELSE 0 END) AS matching_count,
      math::max(IF ${member} THEN (${rank}) ELSE -1 END) AS rank,
      math::max(IF ${member} THEN time::unix(${INVOCATION_TIME}) ELSE 0 END) AS match_time
      FROM task GROUP BY workflow_id`
    const filters = ["matching_count > 0"]
    if (scope.status === "running") filters.push("unfinished_count > 0")
    if (scope.status === "finished") filters.push("unfinished_count = 0")
    if (scope.has_errors === true) filters.push("error_task_count > 0")
    if (scope.has_errors === false) filters.push("error_task_count = 0")
    const memberFiltered = !!(scope.task_name || scope.worker)
    const timeField = memberFiltered ? "match_time" : "last_time"
    if (!memberFiltered) {
      filters.push(`${timeField} <= time::unix(<datetime>$end)`)
      if (scope.start) filters.push(`${timeField} >= time::unix(<datetime>$start)`)
    }
    const totalWhere = filters.join(" AND ")
    const anchor = object(position)
    if (anchor.workflow_id) {
      bindings.afterId = anchor.workflow_id
      bindings.afterRank = anchor.rank
      bindings.afterTime = anchor.time
      filters.push(
        `(rank < $afterRank OR (rank = $afterRank AND ${timeField} < $afterTime) OR (rank = $afterRank AND ${timeField} = $afterTime AND workflow_id > $afterId))`,
      )
    }
    const limit = number(scope.limit)
    bindings.pageLimit = limit + 1
    const candidates = await this.q.rows(
      `SELECT * FROM (${grouped}) WHERE ${filters.join(" AND ")} ORDER BY rank DESC, ${timeField} DESC, workflow_id ASC LIMIT $pageLimit`,
      bindings,
    )
    const [totalRow] = await this.q.rows(
      `SELECT count() AS total FROM (${grouped}) WHERE ${totalWhere} GROUP ALL`,
      bindings,
    )
    const workflows: Row[] = []
    // Aggregate in the database first. Only the bounded candidate list is enriched.
    for (const candidate of candidates) {
      const workflowId = String(candidate.workflow_id)
      const summary = await this.summary(workflowId, scope.task_name)
      const b = { ...bindings, workflowId }
      const names = object(summary.task_counts)
      const workers = await this.q.rows(
        "SELECT worker FROM task WHERE workflow_id = $workflowId AND worker != NONE GROUP BY worker ORDER BY worker LIMIT 4",
        b,
      )
      const workerTotal = await this.q.rows(
        "SELECT count() AS total FROM (SELECT worker FROM task WHERE workflow_id = $workflowId AND worker != NONE GROUP BY worker) GROUP ALL",
        b,
      )
      const matching = memberFiltered
        ? (
            await this.q.rows(
              `SELECT ${taskFields}, (${rank}) AS rank, ${INVOCATION_TIME} AS matching_invocation_at FROM task WHERE workflow_id = $workflowId AND ${member} ORDER BY rank DESC, matching_invocation_at DESC, id ASC LIMIT 1`,
              b,
            )
          )[0]
        : null
      const problem = (
        await this.q.rows(
          `SELECT ${taskFields}, IF state = 'FAILURE' THEN 0 ELSE IF state NOT IN $terminal THEN 1 ELSE 2 END AS priority FROM task WHERE workflow_id = $workflowId AND ${ERROR_EVIDENCE} ORDER BY priority, last_updated DESC, id LIMIT 1`,
          b,
        )
      )[0]
      workflows.push({
        ...summary,
        matching_task_counts: memberFiltered ? await this.counts(`workflow_id = $workflowId AND ${member}`, b) : null,
        task_names: arrayGroups(names),
        omitted_task_name_count: number(names.omitted_name_count),
        workers: workers.slice(0, 3).map((row) => row.worker),
        omitted_worker_count: Math.max(0, number(workerTotal[0]?.total) - 3),
        matching_task: matching ? taskRow(matching, this.now) : null,
        problem_task: problem ? taskRow(problem, this.now) : null,
        _rank: candidate.rank,
        _time: candidate[timeField],
      })
    }
    const result = this.r.page(
      {
        ...this.r.base(),
        effective_filters: {
          task_name: scope.task_name ?? null,
          worker: scope.worker ?? null,
          status: scope.status,
          has_errors: scope.has_errors ?? null,
          within: scope.within,
          start: scope.start,
          end: scope.end,
          time_basis: memberFiltered ? "invocation" : "workflow_activity",
        },
        diagnostics: [],
      },
      "workflows",
      workflows,
      number(totalRow?.total),
      limit,
      (row) => ({ workflow_id: row.workflow_id, rank: row._rank, time: row._time }),
    )
    for (const row of result.workflows as Row[]) {
      delete row._rank
      delete row._time
    }
    return result
  }
  async inspect(position: unknown): Promise<Row> {
    const scope = this.r.scope
    scope.view ??= "overview"
    if ((scope.parent_task_id || scope.task_name) && scope.view !== "tasks")
      throw new ToolError("invalid_arguments", "parent_task_id and task_name require view=tasks.")
    if (scope.view === "overview" && (scope.limit || position))
      throw new ToolError("invalid_arguments", "overview does not accept pagination.")
    const workflowId = String(scope.workflow_id)
    const bindings: Row = { workflowId, terminal: TERMINAL_STATES }
    const workflow = await this.summary(workflowId)
    const base = { ...this.r.base(), workflow }
    const counts = object(workflow.task_counts)
    if (scope.view === "overview") {
      const problems = await this.q.rows(
        `SELECT ${taskFields}, IF state = 'FAILURE' THEN 0 ELSE IF state NOT IN $terminal THEN 1 ELSE 2 END AS priority FROM task WHERE workflow_id = $workflowId AND ${ERROR_EVIDENCE} ORDER BY priority, last_updated DESC, id LIMIT 3`,
        bindings,
      )
      const runningWhere =
        "workflow_id = $workflowId AND state = 'STARTED' AND execution_active = true " +
        "AND execution_observed_at >= <datetime>$executionCutoff AND execution_observed_at <= <datetime>$executionCeiling " +
        "AND execution_observed_at >= last_updated"
      const runningBindings = {
        ...bindings,
        executionCutoff: new Date(this.now - EXECUTION_OBSERVATION_MAX_AGE_MS).toISOString(),
        executionCeiling: new Date(this.now + EXECUTION_OBSERVATION_MAX_AGE_MS).toISOString(),
      }
      const running = await this.q.rows(
        `SELECT ${taskFields} FROM task WHERE ${runningWhere} ORDER BY started_at, id LIMIT 3`,
        runningBindings,
      )
      const runningCount = await this.q.count("task", runningWhere, runningBindings)
      const tasks =
        number(counts.total) <= 25
          ? (
              await this.q.rows(
                `SELECT ${taskFields} FROM task WHERE workflow_id = $workflowId ORDER BY id LIMIT 25`,
                bindings,
              )
            ).map((row) => taskRow(row, this.now))
          : []
      const result = {
        ...base,
        task_names: arrayGroups(counts),
        omitted_task_name_count: counts.omitted_name_count,
        problem_tasks: problems.map((row) => taskRow(row, this.now)),
        omitted_problem_task_count: Math.max(0, number(workflow.error_task_count) - problems.length),
        running_tasks: running.map((row) => taskRow(row, this.now)),
        omitted_running_task_count: Math.max(0, runningCount - running.length),
        tasks,
        member_list_included: number(counts.total) <= 25,
      }
      if (utf8Size(result) > MAX_RESPONSE_BYTES) {
        result.tasks = []
        result.member_list_included = false
      }
      return this.r.finish(result)
    }
    if (scope.view === "task_names") {
      scope.limit ??= 8
      if (number(scope.limit) > 50) throw new ToolError("invalid_arguments", "task_names limit is at most 50.")
      const after = object(position)
      const nameFilter = position ? (after.name === null ? " AND type != NONE" : " AND type > $afterName") : ""
      const [groupTotal] = await this.q.rows(
        "SELECT count() AS total FROM (SELECT type FROM task WHERE workflow_id = $workflowId GROUP BY type) GROUP ALL",
        bindings,
      )
      const groups = await this.q.rows(
        `SELECT type AS name, count() AS count FROM task WHERE workflow_id = $workflowId${nameFilter} GROUP BY type ORDER BY name LIMIT $pageLimit`,
        { ...bindings, afterName: after.name ?? null, pageLimit: number(scope.limit) + 1 },
      )
      return this.r.page(
        base,
        "task_names",
        groups.map(groupRow),
        number(groupTotal?.total),
        number(scope.limit),
        (row) => ({ name: row.name }),
      )
    }
    scope.limit ??= 25
    const conditions = ["workflow_id = $workflowId"]
    if (scope.parent_task_id) {
      bindings.parentId = scope.parent_task_id
      const parent = await this.q.one("SELECT workflow_id, children FROM type::record('task', $parentId)", bindings)
      if (parent.workflow_id !== workflowId)
        throw new ToolError("invalid_arguments", "Parent task is not a member of this workflow.")
      conditions.push("(parent_id = $parentId OR id IN array::map($children, |$child| type::record('task', $child)))")
      bindings.children = parent.children ?? []
    }
    if (scope.task_name) {
      conditions.push("string::contains(string::lowercase(type ?? ''), $taskName)")
      bindings.taskName = String(scope.task_name).toLowerCase()
    }
    const total = await this.q.count("task", conditions.join(" AND "), bindings)
    if (position) {
      conditions.push("id > type::record('task', $afterId)")
      bindings.afterId = position
    }
    bindings.pageLimit = number(scope.limit) + 1
    const rows = await this.q.rows(
      `SELECT ${taskFields} FROM task WHERE ${conditions.join(" AND ")} ORDER BY id LIMIT $pageLimit`,
      bindings,
    )
    return this.r.page(
      {
        ...base,
        effective_filters: { parent_task_id: scope.parent_task_id ?? null, task_name: scope.task_name ?? null },
      },
      "tasks",
      rows.map((row) => taskRow(row, this.now)),
      total,
      number(scope.limit),
      (row) => row.task_id,
    )
  }
}
const groupRow = (row: Row): Row => ({
  name: row.name ?? null,
  task_counts: {
    total: number(row.count),
    by_name: [{ name: row.name ?? null, count: number(row.count) }],
    omitted_name_count: 0,
  },
})
const arrayGroups = (counts: Row): Row[] => ((counts.by_name as Row[]) ?? []).map(groupRow)
