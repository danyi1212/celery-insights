import { ServerClient, Task } from "@services/server"
import { useStateStore } from "@stores/useStateStore"
import { useCallback, useEffect, useState } from "react"

interface TaskStateResult {
    task: Task | undefined
    loading: boolean
    error: Error | null
    refresh: () => void
}

const useTaskState = (taskId: string): TaskStateResult => {
    const task = useStateStore((state) =>
        taskId ? state.tasks.get(taskId) : undefined
    )
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const refresh = useCallback(() => {
        setLoading(true)
        new ServerClient().tasks
            .getTaskDetail(taskId)
            .then((task) =>
                useStateStore.setState((state) => ({
                    tasks: new Map(state.tasks).set(task.id, task),
                }))
            )
            .catch((error) => setError(error))
            .finally(() => setLoading(false))
    }, [taskId])

    useEffect(() => {
        if (task === undefined) {
            refresh()
        }
    }, [task, taskId, refresh])

    return { task, loading, error, refresh }
}

export default useTaskState
