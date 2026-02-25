import { useMemo } from "react"
import { useLiveQuery } from "./use-live-query"
import type { SurrealEvent } from "@/types/surreal-records"

const byTimestampDesc = (a: SurrealEvent, b: SurrealEvent) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()

const byTimestampAsc = (a: SurrealEvent, b: SurrealEvent) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()

/** Raw events for the events page — ordered by timestamp descending with a limit. */
export const useLiveEvents = (limit = 100) =>
    useLiveQuery<SurrealEvent>({
        initialQuery: "SELECT * FROM event ORDER BY timestamp DESC LIMIT $limit",
        liveTable: "event",
        bindings: useMemo(() => ({ limit }), [limit]),
        orderBy: byTimestampDesc,
        limit,
    })

/** Events for a specific task — ordered by timestamp ascending (chronological). */
export const useTaskEvents = (taskId: string) =>
    useLiveQuery<SurrealEvent>({
        initialQuery: "SELECT * FROM event WHERE task_id = $taskId ORDER BY timestamp",
        liveTable: "event",
        bindings: useMemo(() => ({ taskId }), [taskId]),
        orderBy: byTimestampAsc,
        enabled: !!taskId,
    })
