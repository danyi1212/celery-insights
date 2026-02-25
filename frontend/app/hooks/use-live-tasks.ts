import { useMemo } from "react"
import { useLiveQuery } from "./use-live-query"
import type { SurrealTask } from "@/types/surreal-records"

const byLastUpdatedDesc = (a: SurrealTask, b: SurrealTask) =>
    new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()

/** Recent tasks for the homepage — ordered by last_updated descending with a limit. */
export const useLiveTasks = (limit = 30) =>
    useLiveQuery<SurrealTask>({
        initialQuery: "SELECT * FROM task ORDER BY last_updated DESC LIMIT $limit",
        liveTable: "task",
        bindings: useMemo(() => ({ limit }), [limit]),
        orderBy: byLastUpdatedDesc,
        limit,
    })

/** Tasks for a specific worker. */
export const useWorkerTasks = (workerId: string) =>
    useLiveQuery<SurrealTask>({
        initialQuery: "SELECT * FROM task WHERE worker = $workerId ORDER BY last_updated DESC",
        liveTable: "task",
        bindings: useMemo(() => ({ workerId }), [workerId]),
        orderBy: byLastUpdatedDesc,
        enabled: !!workerId,
    })

/** Workflow tasks — all tasks sharing the same root_id, plus the root task itself. */
export const useWorkflowTasks = (rootTaskId: string) => {
    const bindings = useMemo(() => ({ rootId: rootTaskId, rootRecordId: `task:${rootTaskId}` }), [rootTaskId])

    return useLiveQuery<SurrealTask>({
        initialQuery: "SELECT * FROM task WHERE root_id = $rootId OR id = type::thing('task', $rootId)",
        liveTable: "task",
        bindings,
        enabled: !!rootTaskId,
    })
}

/** Single task detail by ID. */
export const useTask = (taskId: string) => {
    const bindings = useMemo(() => ({ taskId }), [taskId])

    const result = useLiveQuery<SurrealTask>({
        initialQuery: "SELECT * FROM type::thing('task', $taskId)",
        liveTable: "task",
        bindings,
        enabled: !!taskId,
    })

    return {
        ...result,
        task: result.data[0] ?? null,
    }
}
