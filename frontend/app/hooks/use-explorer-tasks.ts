import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ConnectionStatus, LiveSubscription } from "surrealdb"
import { useSurrealDB } from "@components/surrealdb-provider"
import type { SurrealTask } from "@/types/surreal-records"

const DEBOUNCE_MS = 500

export interface ExplorerFilters {
    states?: string[]
    types?: string[]
    workers?: string[]
}

export interface SortConfig {
    field: string
    direction: "ASC" | "DESC"
}

export interface FacetCounts {
    state: Record<string, number>
    type: Record<string, number>
    worker: Record<string, number>
}

export interface UseExplorerTasksResult {
    data: SurrealTask[]
    total: number
    facets: FacetCounts
    isLoading: boolean
    error: Error | null
}

function buildWhereClause(filters: ExplorerFilters): { clause: string; bindings: Record<string, unknown> } {
    const conditions: string[] = []
    const bindings: Record<string, unknown> = {}

    if (filters.states && filters.states.length > 0) {
        conditions.push("state IN $states")
        bindings.states = filters.states
    }
    if (filters.types && filters.types.length > 0) {
        conditions.push("type IN $types")
        bindings.types = filters.types
    }
    if (filters.workers && filters.workers.length > 0) {
        conditions.push("worker IN $workers")
        bindings.workers = filters.workers
    }

    const clause = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : ""
    return { clause, bindings }
}

/**
 * Explorer hook — server-side filtering/pagination via SurrealDB queries.
 * Builds SurrealQL from active facet filters, runs data + facet count queries,
 * and re-runs both (debounced) on any live task notification.
 */
export const useExplorerTasks = (
    filters: ExplorerFilters,
    sort: SortConfig = { field: "last_updated", direction: "DESC" },
    page = 1,
    pageSize = 50,
) => {
    const { db, status } = useSurrealDB()

    const [data, setData] = useState<SurrealTask[]>([])
    const [total, setTotal] = useState(0)
    const [facets, setFacets] = useState<FacetCounts>({ state: {}, type: {}, worker: {} })
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const subscriptionRef = useRef<LiveSubscription | null>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const initializedRef = useRef(false)
    const prevStatusRef = useRef<ConnectionStatus>(status)

    const { clause, bindings: filterBindings } = useMemo(() => buildWhereClause(filters), [filters])

    const offset = (page - 1) * pageSize

    const runQueries = useCallback(async () => {
        try {
            const allBindings = { ...filterBindings, pageSize, offset }

            // Run data query and facet queries in a single multi-statement query
            const [dataResult, countResult, stateFacets, typeFacets, workerFacets] = await db.query<
                [
                    SurrealTask[],
                    [{ count: number }],
                    { state: string; count: number }[],
                    { type: string; count: number }[],
                    { worker: string; count: number }[],
                ]
            >(
                `SELECT * FROM task${clause} ORDER BY ${sort.field} ${sort.direction} LIMIT $pageSize START $offset;` +
                    `SELECT count() AS count FROM task${clause} GROUP ALL;` +
                    `SELECT state, count() AS count FROM task${clause} GROUP BY state;` +
                    `SELECT type, count() AS count FROM task${clause} WHERE type != NONE GROUP BY type;` +
                    `SELECT worker, count() AS count FROM task${clause} WHERE worker != NONE GROUP BY worker;`,
                allBindings,
            )

            setData(Array.isArray(dataResult) ? dataResult : [])
            setTotal(Array.isArray(countResult) && countResult.length > 0 ? countResult[0].count : 0)

            const newFacets: FacetCounts = { state: {}, type: {}, worker: {} }
            if (Array.isArray(stateFacets)) {
                for (const row of stateFacets) newFacets.state[row.state] = row.count
            }
            if (Array.isArray(typeFacets)) {
                for (const row of typeFacets) newFacets.type[row.type] = row.count
            }
            if (Array.isArray(workerFacets)) {
                for (const row of workerFacets) newFacets.worker[row.worker] = row.count
            }
            setFacets(newFacets)

            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)))
        } finally {
            setIsLoading(false)
        }
    }, [db, clause, filterBindings, sort.field, sort.direction, pageSize, offset])

    const debouncedRefresh = useCallback(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            runQueries()
        }, DEBOUNCE_MS)
    }, [runQueries])

    const handleLiveMessage = useCallback(() => {
        debouncedRefresh()
    }, [debouncedRefresh])

    // Re-run queries when filters, sort, or page change
    useEffect(() => {
        if (status !== "connected") return
        setIsLoading(true)
        runQueries()
    }, [status, runQueries])

    // Set up live subscription for real-time refresh
    useEffect(() => {
        if (status !== "connected") return

        let cleanupFn: (() => void) | undefined
        let cancelled = false

        const setupSubscription = async () => {
            try {
                if (subscriptionRef.current) {
                    try {
                        await subscriptionRef.current.kill()
                    } catch {
                        // ignore
                    }
                }

                const subscription = await db.live<Record<string, unknown>>("task")
                if (cancelled) {
                    subscription.kill().catch(() => {})
                    return
                }
                subscriptionRef.current = subscription
                const unsubscribe = subscription.subscribe(handleLiveMessage)
                initializedRef.current = true

                cleanupFn = () => {
                    unsubscribe()
                    subscription.kill().catch(() => {})
                }
            } catch (err) {
                setError(err instanceof Error ? err : new Error(String(err)))
            }
        }

        setupSubscription()

        return () => {
            cancelled = true
            cleanupFn?.()
            if (debounceRef.current) clearTimeout(debounceRef.current)
            if (subscriptionRef.current) {
                subscriptionRef.current.kill().catch(() => {})
                subscriptionRef.current = null
            }
        }
    }, [status, db, handleLiveMessage])

    // Reconnection recovery
    useEffect(() => {
        const wasReconnecting = prevStatusRef.current === "reconnecting"
        prevStatusRef.current = status

        if (wasReconnecting && status === "connected" && initializedRef.current) {
            runQueries()
        }
    }, [status, runQueries])

    return { data, total, facets, isLoading, error }
}
