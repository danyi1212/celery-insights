import { useMemo } from "react"
import { useLiveQuery } from "./use-live-query"
import type { SurrealTask, SurrealWorkflow } from "@/types/surreal-records"

const byWorkflowLastUpdatedDesc = (a: SurrealWorkflow, b: SurrealWorkflow) =>
    new Date(b.last_updated || 0).getTime() - new Date(a.last_updated || 0).getTime()

const byTaskLastUpdatedDesc = (a: SurrealTask, b: SurrealTask) =>
    new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()

export const useLiveWorkflows = (limit = 12) =>
    useLiveQuery<SurrealWorkflow>({
        initialQuery: "SELECT * FROM workflow ORDER BY last_updated DESC LIMIT $limit",
        liveTable: "workflow",
        bindings: useMemo(() => ({ limit }), [limit]),
        orderBy: byWorkflowLastUpdatedDesc,
        limit,
    })

export const useLiveWorkflowTasks = (workflowIds: string[]) => {
    const sortedIds = useMemo(() => [...workflowIds].sort(), [workflowIds])
    const bindings = useMemo(() => ({ workflowIds: sortedIds }), [sortedIds])

    return useLiveQuery<SurrealTask>({
        initialQuery: "SELECT * FROM task WHERE workflow_id IN $workflowIds ORDER BY last_updated DESC LIMIT 200",
        liveTable: "task",
        bindings,
        orderBy: byTaskLastUpdatedDesc,
        filter: (task) => sortedIds.includes(task.workflow_id || ""),
        enabled: sortedIds.length > 0,
        limit: 200,
    })
}
