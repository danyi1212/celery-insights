import { ServerClient } from "@services/server"
import { useStateStore } from "@stores/useStateStore"
import { StateTask, translateTask } from "@utils/translateServerModels"
import { useCallback, useEffect, useState } from "react"

interface TaskStateResult {
    task: StateTask | undefined
    loading: boolean
    error: Error | null
    refresh: () => void
}

const useTaskState = (taskId: string): TaskStateResult => {
    const task = useStateStore(useCallback((state) => state.tasks.get(taskId), [taskId]))
    const [loading, setLoading] = useState(task === undefined)
    const [error, setError] = useState<Error | null>(null)

    const refresh = useCallback(() => {
        setLoading(true)
        new ServerClient().tasks
            .getTaskDetail(taskId)
            .then((task) =>
                useStateStore.setState((state) => ({
                    tasks: state.tasks.iset(task.id, translateTask(task)),
                }))
            )
            .catch((error) => setError(error))
            .finally(() => setLoading(false))
    }, [taskId])

    useEffect(() => {
        if (task === undefined) {
            refresh()
        }
    }, [task, refresh])

    return { task, loading, error, refresh }
}

export default useTaskState
