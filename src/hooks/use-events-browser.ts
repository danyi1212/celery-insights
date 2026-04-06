import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import type { TimeRange } from "@danyi1212/time-range-picker"
import { isLiveTimeRange } from "@danyi1212/time-range-picker/time-range"
import { useSurrealDB } from "@components/surrealdb-provider"
import { resolveTimeRangeBindings } from "@lib/time-range-utils"
import type { SurrealEvent } from "@/types/surreal-records"

const LIVE_REFETCH_MS = 5000
const PAGE_SIZE = 100

export interface EventsBrowserState {
  range: TimeRange
  rangeKey: string
  query: string
  types: string[]
  pageCount: number
}

export interface EventHistogramPoint {
  bucket: string
  count: number
}

interface UseEventsBrowserResult {
  events: SurrealEvent[]
  total: number
  eventTypes: Record<string, number>
  histogram: EventHistogramPoint[]
  isLoading: boolean
  isFetching: boolean
  updatedAt: number
  refetch: () => Promise<unknown>
  error: Error | null
}

interface EventsBrowserPayload {
  events: SurrealEvent[]
  total: number
  eventTypes: Record<string, number>
  histogram: EventHistogramPoint[]
}

const EMPTY_DATA: EventsBrowserPayload = {
  events: [],
  total: 0,
  eventTypes: {},
  histogram: [],
}

function buildWhereClause(state: EventsBrowserState): { clause: string; bindings: Record<string, unknown> } {
  const conditions = ["timestamp >= <datetime>$from", "timestamp <= <datetime>$to"]
  const bindings: Record<string, unknown> = {}

  if (state.query.trim()) {
    conditions.push(
      "(string::contains(string::lowercase(event_type), $query) OR string::contains(string::lowercase(task_id ?? ''), $query) OR string::contains(string::lowercase(hostname ?? ''), $query) OR string::contains(string::lowercase(string::concat('', data ?? '')), $query))",
    )
    bindings.query = state.query.trim().toLowerCase()
  }

  if (state.types.length > 0) {
    conditions.push("event_type IN $types")
    bindings.types = state.types
  }

  return { clause: ` WHERE ${conditions.join(" AND ")}`, bindings }
}

function normalizeStateForKey(state: EventsBrowserState) {
  return {
    ...state,
    types: [...state.types].sort(),
  }
}

export const useEventsBrowser = (state: EventsBrowserState): UseEventsBrowserResult => {
  const { db, status } = useSurrealDB()
  const normalizedState = useMemo(() => normalizeStateForKey(state), [state])
  const rowLimit = Math.max(1, state.pageCount) * PAGE_SIZE
  const queryKey = useMemo(
    () => ["raw-events", normalizedState.rangeKey, normalizedState.query, normalizedState.types.join("|"), rowLimit],
    [normalizedState, rowLimit],
  )

  const query = useQuery<EventsBrowserPayload, Error>({
    queryKey,
    enabled: status === "connected",
    placeholderData: (previousData) => previousData,
    refetchInterval: isLiveTimeRange(state.range) ? LIVE_REFETCH_MS : false,
    queryFn: async () => {
      const timeBindings = resolveTimeRangeBindings(state.range, new Date())
      const { clause, bindings } = buildWhereClause(state)
      const [rows, countRows, facetRows, bucketRows] = await db.query<
        [SurrealEvent[], [{ count: number }], { event_type: string; count: number }[], EventHistogramPoint[]]
      >(
        `SELECT * FROM event${clause} ORDER BY timestamp DESC LIMIT $rowLimit;` +
          `SELECT count() AS count FROM event${clause} GROUP ALL;` +
          `SELECT event_type, count() AS count FROM event${clause} GROUP BY event_type;` +
          `SELECT time::format(time::floor(timestamp, <duration>$bucketDuration), '%Y-%m-%dT%H:%M') AS bucket, count() AS count FROM event${clause} GROUP BY bucket ORDER BY bucket ASC;`,
        { ...timeBindings, ...bindings, rowLimit },
      )

      return {
        events: Array.isArray(rows) ? rows : [],
        total: Array.isArray(countRows) && countRows[0] ? countRows[0].count : 0,
        eventTypes: Object.fromEntries((facetRows ?? []).map((row) => [row.event_type, row.count])),
        histogram: Array.isArray(bucketRows) ? bucketRows : [],
      }
    },
  })

  const data = query.data ?? EMPTY_DATA

  return {
    events: data.events,
    total: data.total,
    eventTypes: data.eventTypes,
    histogram: data.histogram,
    isLoading: query.isLoading || query.isFetching,
    isFetching: query.isFetching,
    updatedAt: query.dataUpdatedAt,
    refetch: () => query.refetch(),
    error: query.error ?? null,
  }
}
