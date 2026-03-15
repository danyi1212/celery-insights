import { useCallback, useMemo } from "react"
import { RecordId } from "surrealdb"
import { useLiveQuery } from "./use-live-query"
import { extractId, type SurrealTask } from "@/types/surreal-records"

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
export const useWorkerTasks = (workerId: string) => {
  const filter = useCallback((t: SurrealTask) => t.worker === workerId, [workerId])
  return useLiveQuery<SurrealTask>({
    initialQuery: "SELECT * FROM task WHERE worker = $workerId ORDER BY last_updated DESC",
    liveTable: "task",
    bindings: useMemo(() => ({ workerId }), [workerId]),
    orderBy: byLastUpdatedDesc,
    filter,
    enabled: !!workerId,
  })
}

/** Workflow tasks — all tasks sharing the same root_id, plus the root task itself. */
export const useWorkflowTasks = (workflowId: string) => {
  const bindings = useMemo(() => ({ workflowId }), [workflowId])
  const filter = useCallback((t: SurrealTask) => t.workflow_id === workflowId, [workflowId])

  return useLiveQuery<SurrealTask>({
    initialQuery: "SELECT * FROM task WHERE workflow_id = $workflowId ORDER BY last_updated DESC",
    liveTable: "task",
    bindings,
    filter,
    enabled: !!workflowId,
  })
}

/** Single task detail by ID. */
export const useTask = (taskId: string) => {
  const bindings = useMemo(() => ({ rid: new RecordId("task", taskId) }), [taskId])
  const filter = useCallback((t: SurrealTask) => extractId(t.id) === taskId, [taskId])

  const result = useLiveQuery<SurrealTask>({
    initialQuery: "SELECT * FROM $rid",
    liveTable: "task",
    bindings,
    filter,
    enabled: !!taskId,
  })

  return {
    ...result,
    task: result.data[0] ?? null,
  }
}
