import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import type { TimeRange } from "@danyi1212/time-range-picker"
import { isLiveTimeRange } from "@danyi1212/time-range-picker/time-range"
import { useSurrealDB } from "@components/surrealdb-provider"
import { resolveTimeRangeBindings } from "@lib/time-range-utils"
import { buildExplorerQuery } from "@lib/explorer-query"
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
      const built = buildExplorerQuery(state, resolveTimeRangeBindings(state.range, new Date()), rowLimit)

      if (state.mode === "tasks") {
        const results = await db.query<
          [
            SurrealTask[],
            [{ count: number }],
            { state: string; count: number }[],
            { type: string; count: number }[],
            { worker: string; count: number }[],
            { bucket: string; state: string; count: number }[],
          ]
        >(built.sql, built.bindings)

        const [taskRows, countRows, stateFilters, typeFilters, workerFilters, buckets] = results.slice(
          built.preludeCount,
        ) as typeof results

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

      const results = await db.query<
        [
          SurrealWorkflow[],
          [{ count: number }],
          { aggregate_state: string; count: number }[],
          { root_task_type: string; count: number }[],
          { bucket: string; aggregate_state: string; count: number }[],
        ]
      >(built.sql, built.bindings)
      // Each LET statement occupies a result slot.
      const [workflowRows, countRows, workflowStateFilters, rootTypeFilters, buckets] = results.slice(
        built.preludeCount,
      ) as typeof results

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
