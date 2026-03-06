import { useCallback, useEffect, useRef, useState } from "react"
import type { ConnectionStatus, LiveMessage, LiveSubscription, Uuid } from "surrealdb"
import { useSurrealDB } from "@components/surrealdb-provider"

export interface UseLiveQueryOptions<T> {
    /** Initial data fetch query — supports full SurrealQL (ORDER BY, LIMIT, GROUP BY, etc.) */
    initialQuery: string
    /** Table to subscribe to via LIVE SELECT (no ORDER/LIMIT/GROUP support) */
    liveTable: string
    /** Query parameter bindings for the initial query */
    bindings?: Record<string, unknown>
    /** Client-side sort comparator applied after live patches */
    orderBy?: (a: T, b: T) => number
    /** Client-side limit applied after sorting */
    limit?: number
    /** Client-side filter predicate for live notifications. When set, CREATE/UPDATE records are only added if they pass this filter. */
    filter?: (record: T) => boolean
    /** Whether to enable the query (default: true). When false, skips both initial fetch and live subscription. */
    enabled?: boolean
}

export interface UseLiveQueryResult<T> {
    data: T[]
    isLoading: boolean
    error: Error | null
}

/**
 * Generic hook for SurrealDB live queries using a two-phase pattern:
 * 1. Run an initial query (full SurrealQL with ORDER/LIMIT/GROUP)
 * 2. Subscribe via LIVE SELECT for real-time CREATE/UPDATE/DELETE notifications
 * 3. Apply client-side ordering and limiting after live patches
 *
 * Handles reconnection recovery: on reconnect, re-runs the initial query
 * and re-subscribes to catch events missed during disconnection.
 */
export function useLiveQuery<T extends { id: unknown }>(options: UseLiveQueryOptions<T>): UseLiveQueryResult<T> {
    const { initialQuery, liveTable, bindings, orderBy, limit, filter, enabled = true } = options
    const { db, status } = useSurrealDB()

    const [data, setData] = useState<T[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const subscriptionRef = useRef<LiveSubscription | null>(null)
    const initializedRef = useRef(false)
    const prevStatusRef = useRef<ConnectionStatus>(status)

    // Use refs for orderBy/limit/filter to avoid recreating callbacks when these change.
    // These are typically inline functions/values that change identity every render.
    const orderByRef = useRef(orderBy)
    orderByRef.current = orderBy
    const limitRef = useRef(limit)
    limitRef.current = limit
    const filterRef = useRef(filter)
    filterRef.current = filter

    const applyOrderAndLimit = useCallback((items: T[]): T[] => {
        let result = items
        if (orderByRef.current) {
            result = [...result].sort(orderByRef.current)
        }
        if (limitRef.current !== undefined && result.length > limitRef.current) {
            result = result.slice(0, limitRef.current)
        }
        return result
    }, [])

    const handleLiveMessage = useCallback(
        (message: LiveMessage) => {
            const { action, value } = message
            const record = value as T
            const matchesFilter = !filterRef.current || filterRef.current(record)

            if (action === "CREATE") {
                if (!matchesFilter) return
                setData((prev) => {
                    const exists = prev.some((item) => recordIdEquals(item.id, record.id))
                    if (exists) return prev
                    const next = [...prev, record]
                    return applyOrderAndLimit(next)
                })
            } else if (action === "UPDATE") {
                setData((prev) => {
                    const idx = prev.findIndex((item) => recordIdEquals(item.id, record.id))
                    if (idx === -1) {
                        // Record not in current list — only add if it matches our filter
                        if (!matchesFilter) return prev
                        const next = [...prev, record]
                        return applyOrderAndLimit(next)
                    }
                    // Record is in current list — if it no longer matches, remove it; otherwise update
                    if (!matchesFilter) {
                        const next = prev.filter((item) => !recordIdEquals(item.id, record.id))
                        return next
                    }
                    const next = [...prev]
                    next[idx] = record
                    return applyOrderAndLimit(next)
                })
            } else if (action === "DELETE") {
                setData((prev) => {
                    const next = prev.filter((item) => !recordIdEquals(item.id, record.id))
                    if (next.length === prev.length) return prev
                    return next
                })
            }
        },
        [applyOrderAndLimit],
    )

    const runInitialQuery = useCallback(async () => {
        try {
            const [result] = await db.query<[T[]]>(initialQuery, bindings)
            // SurrealDB JS SDK v2 returns a single object (not an array) for
            // record-specific SELECTs (e.g. SELECT * FROM $rid).
            // Normalize to always work with arrays.
            const items = Array.isArray(result) ? result : result != null ? [result as T] : []
            setData(items)
            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)))
        } finally {
            setIsLoading(false)
        }
    }, [db, initialQuery, bindings])

    const startLiveSubscription = useCallback(async () => {
        // Kill existing subscription if any
        if (subscriptionRef.current) {
            try {
                await subscriptionRef.current.kill()
            } catch {
                // Ignore kill errors (connection may be lost)
            }
            subscriptionRef.current = null
        }

        try {
            // Use raw LIVE SELECT + liveOf() instead of db.live().
            // The JS SDK v2's db.live() binds the table name as a query parameter
            // ($bind__N), but SurrealDB v2.x doesn't support parameterized table
            // names in LIVE SELECT, causing silent subscription failures.
            const [liveId] = await db.query<[Uuid]>(`LIVE SELECT * FROM ${liveTable}`)
            const subscription = await db.liveOf(liveId)
            subscriptionRef.current = subscription

            const unsubscribe = subscription.subscribe(handleLiveMessage)

            return () => {
                unsubscribe()
                subscription.kill().catch(() => {})
            }
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)))
            return undefined
        }
    }, [db, liveTable, handleLiveMessage])

    // Initialize: run initial query and start live subscription when connected
    useEffect(() => {
        if (!enabled) {
            setData([])
            setIsLoading(false)
            initializedRef.current = false
            return
        }

        if (status !== "connected") return

        let cleanupLive: (() => void) | undefined
        let cancelled = false

        const initialize = async () => {
            setIsLoading(true)
            await runInitialQuery()
            if (cancelled) return
            cleanupLive = await startLiveSubscription()
            initializedRef.current = true
        }

        initialize()

        return () => {
            cancelled = true
            initializedRef.current = false
            cleanupLive?.()
            if (subscriptionRef.current) {
                subscriptionRef.current.kill().catch(() => {})
                subscriptionRef.current = null
            }
        }
    }, [enabled, status, runInitialQuery, startLiveSubscription])

    // Reconnection recovery: when status transitions from reconnecting to connected,
    // re-run initial query and re-subscribe to catch missed events.
    // The initialization effect above already handles this (it re-runs when status
    // changes to "connected"), and its cleanup resets initializedRef to false,
    // so this guard prevents duplicate recovery.
    useEffect(() => {
        const wasReconnecting = prevStatusRef.current === "reconnecting"
        prevStatusRef.current = status

        if (wasReconnecting && status === "connected" && initializedRef.current && enabled) {
            let cleanupLive: (() => void) | undefined
            let cancelled = false

            const recover = async () => {
                await runInitialQuery()
                if (cancelled) return
                cleanupLive = await startLiveSubscription()
            }

            recover()

            return () => {
                cancelled = true
                cleanupLive?.()
            }
        }
    }, [status, enabled, runInitialQuery, startLiveSubscription])

    return { data, isLoading, error }
}

/** Compare SurrealDB record IDs which may be strings or RecordId objects */
function recordIdEquals(a: unknown, b: unknown): boolean {
    if (a === b) return true
    // SurrealDB IDs can be RecordId objects with a toString method
    return String(a) === String(b)
}
