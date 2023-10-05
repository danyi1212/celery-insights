import { useClient } from "@hooks/useClient"
import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"

const useTaskResult = (taskId: string) => {
    const client = useClient()
    const getTaskResult = useCallback(() => client.tasks.getTaskResult(taskId), [client, taskId])
    const query = useQuery(["results", taskId], getTaskResult)
    return {
        ...query,
        taskResult: query.data,
    }
}

export default useTaskResult
