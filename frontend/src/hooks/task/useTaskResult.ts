import { useClient } from "@hooks/useClient"
import { useQuery } from "@tanstack/react-query"
import { useCallback } from "react"

const useTaskResult = (taskId: string) => {
    const client = useClient()
    const getTaskResult = useCallback(() => client.tasks.getTaskResult(taskId), [client, taskId])
    const query = useQuery({
        queryKey: ["results", taskId],
        queryFn: getTaskResult,
    })
    return {
        ...query,
        taskResult: query.data,
    }
}

export default useTaskResult
