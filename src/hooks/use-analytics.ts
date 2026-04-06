import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Table, type ConnectionStatus, type LiveMessage, type LiveSubscription } from "surrealdb"
import type { TimeRange } from "@danyi1212/time-range-picker"
import { isLiveTimeRange } from "@danyi1212/time-range-picker/time-range"
import { useSurrealDB } from "@components/surrealdb-provider"
import { useNow } from "./use-now"
import { createDefaultTimeRange, resolveTimeRangeBindings } from "@lib/time-range-utils"

const DEBOUNCE_MS = 2000

export interface ThroughputPoint {
  bucket: string
  count: number
}

export interface FailureRatePoint {
  bucket: string
  success: number
  failure: number
  total: number
  failure_rate: number
}

export interface DurationByType {
  type: string
  avg_runtime: number
  min_runtime: number
  max_runtime: number
  count: number
}

export interface WorkerLoadPoint {
  worker: string
  count: number
}

export interface AnalyticsData {
  throughput: ThroughputPoint[]
  failureRate: FailureRatePoint[]
  durationByType: DurationByType[]
  workerLoad: WorkerLoadPoint[]
}

/**
 * Analytics hook — runs aggregation queries for historical analytics
 * and re-runs them (debounced) on any task change via live subscription.
 *
 * Uses the same debounced-refresh pattern as useExceptionsSummary since
 * aggregation results cannot be incrementally patched from live notifications.
 */
export const useAnalytics = (timeRange: TimeRange = createDefaultTimeRange()) => {
  const { db, status } = useSurrealDB()
  const now = useNow(isLiveTimeRange(timeRange) ? 60_000 : undefined)

  const [data, setData] = useState<AnalyticsData>({
    throughput: [],
    failureRate: [],
    durationByType: [],
    workerLoad: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const subscriptionRef = useRef<LiveSubscription | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initializedRef = useRef(false)
  const prevStatusRef = useRef<ConnectionStatus>(status)

  const resolvedBindings = resolveTimeRangeBindings(timeRange, now)
  const bindings = useMemo(
    () => ({
      from: resolvedBindings.from,
      to: resolvedBindings.to,
      bucketDuration: resolvedBindings.bucketDuration,
    }),
    [resolvedBindings.from, resolvedBindings.to, resolvedBindings.bucketDuration],
  )

  const runQueries = useCallback(async () => {
    try {
      const [throughput, failureRate, durationByType, workerLoad] = await db.query<
        [ThroughputPoint[], FailureRatePoint[], DurationByType[], WorkerLoadPoint[]]
      >(
        // Task throughput: tasks per bucket over time
        `SELECT
                    time::format(time::floor(last_updated, <duration>$bucketDuration), '%Y-%m-%dT%H:%M') AS bucket,
                    count() AS count
                FROM task
                WHERE last_updated >= <datetime>$from
                    AND last_updated <= <datetime>$to
                GROUP BY bucket
                ORDER BY bucket ASC;` +
          // Failure rate: success vs failure per bucket
          `SELECT
                    time::format(time::floor(last_updated, <duration>$bucketDuration), '%Y-%m-%dT%H:%M') AS bucket,
                    math::sum(IF state = 'SUCCESS' THEN 1 ELSE 0 END) AS success,
                    math::sum(IF state = 'FAILURE' THEN 1 ELSE 0 END) AS failure,
                    count() AS total,
                    math::sum(IF state = 'FAILURE' THEN 1 ELSE 0 END) / count() * 100 AS failure_rate
                FROM task
                WHERE last_updated >= <datetime>$from
                    AND last_updated <= <datetime>$to
                    AND state IN ['SUCCESS', 'FAILURE']
                GROUP BY bucket
                ORDER BY bucket ASC;` +
          // Duration by task type: avg/min/max runtime
          `SELECT
                    type,
                    math::mean(runtime) AS avg_runtime,
                    math::min(runtime) AS min_runtime,
                    math::max(runtime) AS max_runtime,
                    count() AS count
                FROM task
                WHERE last_updated >= <datetime>$from
                    AND last_updated <= <datetime>$to
                    AND runtime != NONE
                    AND type != NONE
                GROUP BY type
                ORDER BY count DESC
                LIMIT 15;` +
          // Worker load: tasks per worker
          `SELECT
                    worker,
                    count() AS count
                FROM task
                WHERE last_updated >= <datetime>$from
                    AND last_updated <= <datetime>$to
                    AND worker != NONE
                GROUP BY worker
                ORDER BY count DESC;`,
        bindings,
      )

      setData({
        throughput: Array.isArray(throughput) ? throughput : [],
        failureRate: Array.isArray(failureRate) ? failureRate : [],
        durationByType: Array.isArray(durationByType) ? durationByType : [],
        workerLoad: Array.isArray(workerLoad) ? workerLoad : [],
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }, [db, bindings])

  const debouncedRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runQueries()
    }, DEBOUNCE_MS)
  }, [runQueries])

  const handleLiveMessage = useCallback(
    (message: LiveMessage) => {
      if (message.action === "CREATE" || message.action === "UPDATE") {
        debouncedRefresh()
      }
    },
    [debouncedRefresh],
  )

  useEffect(() => {
    if (status !== "connected") return

    let cleanupFn: (() => void) | undefined
    let cancelled = false

    const initialize = async () => {
      setIsLoading(true)
      await runQueries()
      if (cancelled) return

      try {
        if (subscriptionRef.current) {
          try {
            await subscriptionRef.current.kill()
          } catch {
            // ignore
          }
        }

        const subscription = await db.live<Record<string, unknown>>(new Table("task"))
        subscriptionRef.current = subscription
        const unsubscribe = subscription.subscribe(handleLiveMessage)

        cleanupFn = () => {
          unsubscribe()
          subscription.kill().catch(() => {})
        }
        initializedRef.current = true
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
      }
    }

    initialize()

    return () => {
      cancelled = true
      cleanupFn?.()
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (subscriptionRef.current) {
        subscriptionRef.current.kill().catch(() => {})
        subscriptionRef.current = null
      }
    }
  }, [status, db, runQueries, handleLiveMessage])

  // Reconnection recovery
  useEffect(() => {
    const wasReconnecting = prevStatusRef.current === "reconnecting"
    prevStatusRef.current = status

    if (wasReconnecting && status === "connected" && initializedRef.current) {
      runQueries()
    }
  }, [status, runQueries])

  return { data, isLoading, error, timeRange }
}
