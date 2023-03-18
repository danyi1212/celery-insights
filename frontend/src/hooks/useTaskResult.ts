import { ServerClient } from "@services/server"
import { useCallback } from "react"
import { useQuery } from "react-query"

const useTaskResult = (taskId: string) => {
    const getTaskResult = useCallback(
        () => new ServerClient().tasks.getTaskResult(taskId),
        [taskId]
    )
    const query = useQuery(["results", taskId], getTaskResult)
    return {
        ...query,
        taskResult: query.data,
    }
}

export default useTaskResult
