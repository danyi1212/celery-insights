import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import type { TimeRange } from "@danyi1212/time-range-picker"
import { isLiveTimeRange } from "@danyi1212/time-range-picker/time-range"
import { useSurrealDB } from "@components/surrealdb-provider"
import { resolveTimeRangeBindings } from "@lib/time-range-utils"
import type { SurrealTask, SurrealWorkflow } from "@/types/surreal-records"

export type ExplorerMode = "tasks" | "workflows"

export interface ExplorerQueryState {
  mode: ExplorerMode
  range: TimeRange
  rangeKey: string
  query: string
  states: string[]
  types: string[]
  workers: string[]
  workflowStates: string[]
  rootTypes: string[]
  sortField: string
  sortDirection: "ASC" | "DESC"
  pageCount: number
}

export interface HistogramPoint {
  bucket: string
  count: number
  state?: string
}

export interface ExplorerFilterCounts {
  state: Record<string, number>
  type: Record<string, number>
  worker: Record<string, number>
  aggregate_state: Record<string, number>
  root_task_type: Record<string, number>
}

interface UseExplorerDataResult {
  tasks: SurrealTask[]
  workflows: SurrealWorkflow[]
  total: number
  histogram: HistogramPoint[]
  filters: ExplorerFilterCounts
  isLoading: boolean
  isFetching: boolean
  updatedAt: number
  refetch: () => Promise<unknown>
  error: Error | null
}

interface ExplorerDataPayload {
  tasks: SurrealTask[]
  workflows: SurrealWorkflow[]
  total: number
  histogram: HistogramPoint[]
  filters: ExplorerFilterCounts
}

const LIVE_REFETCH_MS = 5000

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

const EMPTY_FILTERS: ExplorerFilterCounts = {
  state: {},
  type: {},
  worker: {},
  aggregate_state: {},
  root_task_type: {},
}

const EMPTY_DATA: ExplorerDataPayload = {
  tasks: [],
  workflows: [],
  total: 0,
  histogram: [],
  filters: EMPTY_FILTERS,
}

function appendCondition(clause: string, condition: string): string {
  return `${clause} AND ${condition}`
}

function buildTaskWhereClause(state: ExplorerQueryState): { clause: string; bindings: Record<string, unknown> } {
  const conditions = ["last_updated >= <datetime>$from", "last_updated <= <datetime>$to"]
  const bindings: Record<string, unknown> = {}
  const trimmedQuery = state.query.trim()

  if (trimmedQuery) {
    conditions.push(
      "(string::contains(string::lowercase(string::concat('', id)), $query) OR string::contains(string::lowercase(type ?? ''), $query) OR string::contains(string::lowercase(worker ?? ''), $query) OR string::contains(string::lowercase(exception ?? ''), $query) OR string::contains(string::lowercase(result ?? ''), $query))",
    )
    bindings.query = trimmedQuery.toLowerCase()
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

  return { clause: ` WHERE ${conditions.join(" AND ")}`, bindings }
}

function buildWorkflowWhereClause(state: ExplorerQueryState): { clause: string; bindings: Record<string, unknown> } {
  const conditions = ["last_updated >= <datetime>$from", "last_updated <= <datetime>$to"]
  const bindings: Record<string, unknown> = {}
  const trimmedQuery = state.query.trim()

  if (trimmedQuery) {
    conditions.push(
      "(string::contains(string::lowercase(root_task_id), $query) OR string::contains(string::lowercase(root_task_type ?? ''), $query) OR string::contains(string::lowercase(latest_exception_preview ?? ''), $query))",
    )
    bindings.query = trimmedQuery.toLowerCase()
  }
  if (state.workflowStates.length > 0) {
    conditions.push("aggregate_state IN $workflowStates")
    bindings.workflowStates = state.workflowStates
  }
  if (state.rootTypes.length > 0) {
    conditions.push("root_task_type IN $rootTypes")
    bindings.rootTypes = state.rootTypes
  }

  return { clause: ` WHERE ${conditions.join(" AND ")}`, bindings }
}

function normalizeStateForKey(state: ExplorerQueryState) {
  return {
    ...state,
    states: [...state.states].sort(),
    types: [...state.types].sort(),
    workers: [...state.workers].sort(),
    workflowStates: [...state.workflowStates].sort(),
    rootTypes: [...state.rootTypes].sort(),
  }
}

export const useExplorerData = (state: ExplorerQueryState, pageSize = 50): UseExplorerDataResult => {
  const { db, status } = useSurrealDB()

  const normalizedState = useMemo(() => normalizeStateForKey(state), [state])
  const rowLimit = Math.max(1, state.pageCount) * pageSize
  const queryKey = useMemo(
    () => [
      "explorer",
      normalizedState.mode,
      normalizedState.rangeKey,
      normalizedState.query,
      normalizedState.states.join("|"),
      normalizedState.types.join("|"),
      normalizedState.workers.join("|"),
      normalizedState.workflowStates.join("|"),
      normalizedState.rootTypes.join("|"),
      normalizedState.sortField,
      normalizedState.sortDirection,
      rowLimit,
    ],
    [normalizedState, rowLimit],
  )

  const query = useQuery<ExplorerDataPayload, Error>({
    queryKey,
    enabled: status === "connected",
    placeholderData: (previousData) => previousData,
    refetchInterval: isLiveTimeRange(state.range) ? LIVE_REFETCH_MS : false,
    queryFn: async () => {
      const bindings = resolveTimeRangeBindings(state.range, new Date())

      if (state.mode === "tasks") {
        const { clause, bindings: whereBindings } = buildTaskWhereClause(state)
        const sortField = TASK_SORT_FIELDS.has(state.sortField) ? state.sortField : "last_updated"
        const [taskRows, countRows, stateFilters, typeFilters, workerFilters, buckets] = await db.query<
          [
            SurrealTask[],
            [{ count: number }],
            { state: string; count: number }[],
            { type: string; count: number }[],
            { worker: string; count: number }[],
            { bucket: string; state: string; count: number }[],
          ]
        >(
          `SELECT * FROM task${clause} ORDER BY ${sortField} ${state.sortDirection} LIMIT $rowLimit;` +
            `SELECT count() AS count FROM task${clause} GROUP ALL;` +
            `SELECT state, count() AS count FROM task${clause} GROUP BY state;` +
            `SELECT type, count() AS count FROM task${appendCondition(clause, "type != NONE")} GROUP BY type;` +
            `SELECT worker, count() AS count FROM task${appendCondition(clause, "worker != NONE")} GROUP BY worker;` +
            `SELECT time::format(time::floor(last_updated, <duration>$bucketDuration), '%Y-%m-%dT%H:%M') AS bucket, state, count() AS count FROM task${clause} GROUP BY bucket, state ORDER BY bucket ASC;`,
          { ...bindings, ...whereBindings, rowLimit },
        )

        return {
          tasks: Array.isArray(taskRows) ? taskRows : [],
          workflows: [],
          total: Array.isArray(countRows) && countRows[0] ? countRows[0].count : 0,
          histogram: Array.isArray(buckets) ? buckets : [],
          filters: {
            state: Object.fromEntries((stateFilters ?? []).map((row) => [row.state, row.count])),
            type: Object.fromEntries((typeFilters ?? []).map((row) => [row.type, row.count])),
            worker: Object.fromEntries((workerFilters ?? []).map((row) => [row.worker, row.count])),
            aggregate_state: {},
            root_task_type: {},
          },
        }
      }

      const { clause, bindings: whereBindings } = buildWorkflowWhereClause(state)
      const sortField = WORKFLOW_SORT_FIELDS.has(state.sortField) ? state.sortField : "last_updated"
      const [workflowRows, countRows, workflowStateFilters, rootTypeFilters, buckets] = await db.query<
        [
          SurrealWorkflow[],
          [{ count: number }],
          { aggregate_state: string; count: number }[],
          { root_task_type: string; count: number }[],
          { bucket: string; aggregate_state: string; count: number }[],
        ]
      >(
        `SELECT * FROM workflow${clause} ORDER BY ${sortField} ${state.sortDirection} LIMIT $rowLimit;` +
          `SELECT count() AS count FROM workflow${clause} GROUP ALL;` +
          `SELECT aggregate_state, count() AS count FROM workflow${clause} GROUP BY aggregate_state;` +
          `SELECT root_task_type, count() AS count FROM workflow${appendCondition(clause, "root_task_type != NONE")} GROUP BY root_task_type;` +
          `SELECT time::format(time::floor(last_updated, <duration>$bucketDuration), '%Y-%m-%dT%H:%M') AS bucket, aggregate_state, count() AS count FROM workflow${clause} GROUP BY bucket, aggregate_state ORDER BY bucket ASC;`,
        { ...bindings, ...whereBindings, rowLimit },
      )

      return {
        tasks: [],
        workflows: Array.isArray(workflowRows) ? workflowRows : [],
        total: Array.isArray(countRows) && countRows[0] ? countRows[0].count : 0,
        histogram: Array.isArray(buckets)
          ? buckets.map((row) => ({ bucket: row.bucket, count: row.count, state: row.aggregate_state }))
          : [],
        filters: {
          state: {},
          type: {},
          worker: {},
          aggregate_state: Object.fromEntries(
            (workflowStateFilters ?? []).map((row) => [row.aggregate_state, row.count]),
          ),
          root_task_type: Object.fromEntries((rootTypeFilters ?? []).map((row) => [row.root_task_type, row.count])),
        },
      }
    },
  })

  const data = query.data ?? EMPTY_DATA

  return {
    tasks: data.tasks,
    workflows: data.workflows,
    total: data.total,
    histogram: data.histogram,
    filters: data.filters,
    isLoading: query.isLoading || query.isFetching,
    isFetching: query.isFetching,
    updatedAt: query.dataUpdatedAt,
    refetch: () => query.refetch(),
    error: query.error ?? null,
  }
}
