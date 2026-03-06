import { useCallback, useEffect, useRef, useState } from "react"
import { Table, type ConnectionStatus, type LiveMessage, type LiveSubscription } from "surrealdb"
import { useSurrealDB } from "@components/surrealdb-provider"
import type { ExceptionSummary } from "@/types/surreal-records"

const DEBOUNCE_MS = 2000

/**
 * Exceptions summary — runs an aggregation query and re-runs it (debounced)
 * whenever any task is created or updated via live subscription.
 *
 * This does NOT use the standard useLiveQuery pattern because the data shape
 * (GROUP BY aggregation) cannot be incrementally patched from live notifications.
 */
export const useExceptionsSummary = () => {
    const { db, status } = useSurrealDB()

    const [data, setData] = useState<ExceptionSummary[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const subscriptionRef = useRef<LiveSubscription | null>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const initializedRef = useRef(false)
    const prevStatusRef = useRef<ConnectionStatus>(status)

    const runAggregation = useCallback(async () => {
        try {
            const [result] = await db.query<[ExceptionSummary[]]>(
                "SELECT exception, count() AS count FROM task WHERE exception != NONE GROUP BY exception ORDER BY count DESC",
            )
            setData(Array.isArray(result) ? result : [])
            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)))
        } finally {
            setIsLoading(false)
        }
    }, [db])

    const debouncedRefresh = useCallback(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            runAggregation()
        }, DEBOUNCE_MS)
    }, [runAggregation])

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
            await runAggregation()
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
    }, [status, db, runAggregation, handleLiveMessage])

    // Reconnection recovery
    useEffect(() => {
        const wasReconnecting = prevStatusRef.current === "reconnecting"
        prevStatusRef.current = status

        if (wasReconnecting && status === "connected" && initializedRef.current) {
            runAggregation()
        }
    }, [status, runAggregation])

    return { data, isLoading, error }
}
