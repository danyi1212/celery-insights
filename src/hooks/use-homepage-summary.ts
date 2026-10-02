import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { subMinutes } from "date-fns"
import { Table, type ConnectionStatus, type LiveMessage, type LiveSubscription } from "surrealdb"
import { useSurrealDB } from "@components/surrealdb-provider"

const DEBOUNCE_MS = 1500
const RECENT_WINDOW = "3600s"
const THROUGHPUT_BUCKET = "600s"

interface SummaryCountsRow {
  recent_task_count: number
}

interface FailureCountsRow {
  recent_failure_count: number
}

interface LatestUpdateRow {
  last_updated?: string
}

export interface HomepageThroughputPoint {
  bucket: string
  tasks: number
  success: number
  errors: number
}

interface ThroughputCountRow {
  bucket: string
  count: number
}

export interface HomepageSummaryData {
  recentTaskCount: number
  recentFailureCount: number
  latestTaskUpdatedAt: string | null
  throughput: HomepageThroughputPoint[]
}

const defaultData: HomepageSummaryData = {
  recentTaskCount: 0,
  recentFailureCount: 0,
  latestTaskUpdatedAt: null,
  throughput: [],
}

const toUtcBucketKey = (date: Date) => {
  const flooredMinutes = Math.floor(date.getUTCMinutes() / 10) * 10
  const bucketDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), flooredMinutes, 0, 0),
  )

  const year = bucketDate.getUTCFullYear()
  const month = String(bucketDate.getUTCMonth() + 1).padStart(2, "0")
  const day = String(bucketDate.getUTCDate()).padStart(2, "0")
  const hours = String(bucketDate.getUTCHours()).padStart(2, "0")
  const minutes = String(bucketDate.getUTCMinutes()).padStart(2, "0")

  return `${year}-${month}-${day}T${hours}:${minutes}:00Z`
}

const normalizeThroughput = (tasks: ThroughputCountRow[], errors: ThroughputCountRow[]) => {
  const taskMap = new Map(tasks.map((point) => [point.bucket, point.count]))
  const errorMap = new Map(errors.map((point) => [point.bucket, point.count]))

  return Array.from({ length: 7 }, (_, index) => {
    const bucket = toUtcBucketKey(subMinutes(new Date(), (6 - index) * 10))
    const taskCount = taskMap.get(bucket) ?? 0
    const errorCount = errorMap.get(bucket) ?? 0
    return {
      bucket,
      tasks: taskCount,
      success: Math.max(taskCount - errorCount, 0),
      errors: errorCount,
    }
  })
}

export const useHomepageSummary = () => {
  const { db, status } = useSurrealDB()
  const [data, setData] = useState<HomepageSummaryData>(defaultData)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const subscriptionRef = useRef<LiveSubscription | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initializedRef = useRef(false)
  const prevStatusRef = useRef<ConnectionStatus>(status)

  const bindings = useMemo(() => ({ recentWindow: RECENT_WINDOW, throughputBucket: THROUGHPUT_BUCKET }), [])

  const runQueries = useCallback(async () => {
    try {
      const [recentTasks, recentFailures, latestTask, throughputTasks, throughputErrors] = await db.query<
        [SummaryCountsRow[], FailureCountsRow[], LatestUpdateRow[], ThroughputCountRow[], ThroughputCountRow[]]
      >(
        `SELECT count() AS recent_task_count
                FROM task
                WHERE last_updated > time::now() - <duration>$recentWindow;` +
          `SELECT count() AS recent_failure_count
                FROM task
                WHERE last_updated > time::now() - <duration>$recentWindow
                    AND (state = 'FAILURE' OR exception != NONE);` +
          `SELECT last_updated
                FROM task
                ORDER BY last_updated DESC
                LIMIT 1;` +
          `SELECT
                    time::format(time::floor(last_updated, <duration>$throughputBucket), '%Y-%m-%dT%H:%M:%SZ') AS bucket,
                    count() AS count
                FROM task
                WHERE last_updated > time::now() - <duration>$recentWindow
                GROUP BY bucket
                ORDER BY bucket ASC;` +
          `SELECT
                    time::format(time::floor(last_updated, <duration>$throughputBucket), '%Y-%m-%dT%H:%M:%SZ') AS bucket,
                    count() AS count
                FROM task
                WHERE last_updated > time::now() - <duration>$recentWindow
                    AND (state = 'FAILURE' OR exception != NONE)
                GROUP BY bucket
                ORDER BY bucket ASC;`,
        bindings,
      )

      setData({
        recentTaskCount: recentTasks[0]?.recent_task_count ?? 0,
        recentFailureCount: recentFailures[0]?.recent_failure_count ?? 0,
        latestTaskUpdatedAt: latestTask[0]?.last_updated ?? null,
        throughput: normalizeThroughput(
          Array.isArray(throughputTasks) ? throughputTasks : [],
          Array.isArray(throughputErrors) ? throughputErrors : [],
        ),
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }, [bindings, db])

  const debouncedRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runQueries()
    }, DEBOUNCE_MS)
  }, [runQueries])

  const handleLiveMessage = useCallback(
    (message: LiveMessage) => {
      if (message.action === "CREATE" || message.action === "UPDATE" || message.action === "DELETE") {
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
  }, [db, handleLiveMessage, runQueries, status])

  useEffect(() => {
    const wasReconnecting = prevStatusRef.current === "reconnecting"
    prevStatusRef.current = status

    if (wasReconnecting && status === "connected" && initializedRef.current) {
      runQueries()
    }
  }, [runQueries, status])

  return { data, isLoading, error }
}
