import { useSurrealDB } from "@components/surrealdb-provider"
import { extractId, type SurrealTask, type SurrealWorkflow } from "@/types/surreal-records"
import type { LiveSubscription, Uuid } from "surrealdb"
import { useCallback, useEffect, useRef, useState } from "react"

interface TaskWorkflowSnapshot {
    members: SurrealTask[]
    task: SurrealTask | null
    workflow: SurrealWorkflow | null
}

interface UseTaskWorkflowResult extends TaskWorkflowSnapshot {
    error: Error | null
    isLoading: boolean
}

const EMPTY_RESULT: TaskWorkflowSnapshot = {
    task: null,
    workflow: null,
    members: [],
}

export function useTaskWorkflow(taskId: string): UseTaskWorkflowResult {
    const { db, status } = useSurrealDB()
    const [data, setData] = useState<TaskWorkflowSnapshot>(EMPTY_RESULT)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)
    const subscriptionRef = useRef<LiveSubscription | null>(null)
    const workflowIdRef = useRef<string | null>(null)

    const fetchSnapshot = useCallback(async () => {
        if (!taskId) {
            setData(EMPTY_RESULT)
            setIsLoading(false)
            return
        }

        try {
            const results = await db.query<
                Array<null | {
                    members?: SurrealTask[]
                    task?: SurrealTask | null
                    workflow?: SurrealWorkflow | null
                }>
            >(
                `LET $task = (SELECT * FROM type::record('task', $taskId))[0];
                 LET $workflowId = $task.workflow_id ?? $task.root_id ?? $taskId;
                 RETURN {
                    task: $task,
                    workflow: (SELECT * FROM type::record('workflow', $workflowId))[0],
                    members: SELECT * FROM task WHERE workflow_id = $workflowId ORDER BY last_updated DESC
                };`,
                { taskId },
            )
            const result = results.at(-1)

            const next = {
                task: result?.task ?? null,
                workflow: result?.workflow ?? null,
                members: Array.isArray(result?.members) ? result.members : [],
            }
            workflowIdRef.current = next.task?.workflow_id || next.task?.root_id || next.task?.id?.toString() || taskId
            setData(next)
            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)))
        } finally {
            setIsLoading(false)
        }
    }, [db, taskId])

    useEffect(() => {
        if (status !== "connected") return

        let cancelled = false
        let unsubscribe: (() => void) | undefined

        const start = async () => {
            setIsLoading(true)
            await fetchSnapshot()
            if (cancelled) return

            const [liveId] = await db.query<[Uuid]>("LIVE SELECT * FROM task")
            const subscription = await db.liveOf(liveId)
            subscriptionRef.current = subscription
            unsubscribe = subscription.subscribe((message) => {
                const record = message.value as unknown as SurrealTask
                const recordId = extractId(record.id)
                const workflowId = workflowIdRef.current
                const matchesWorkflow =
                    !!workflowId && (record.workflow_id || record.root_id || recordId) === workflowId
                if (recordId === taskId || matchesWorkflow) {
                    void fetchSnapshot()
                }
            })
        }

        start().catch((err) => {
            setError(err instanceof Error ? err : new Error(String(err)))
            setIsLoading(false)
        })

        return () => {
            cancelled = true
            unsubscribe?.()
            if (subscriptionRef.current) {
                subscriptionRef.current.kill().catch(() => {})
                subscriptionRef.current = null
            }
        }
    }, [db, fetchSnapshot, status, taskId])

    return { ...data, isLoading, error }
}
