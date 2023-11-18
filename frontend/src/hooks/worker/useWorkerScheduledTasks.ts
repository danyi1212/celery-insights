import { useClient } from "@hooks/useClient"
import { useQuery } from "@tanstack/react-query"
import { useCallback } from "react"

const useWorkerScheduledTasks = (hostname: string, timeout?: number, interval = 1000) => {
    const client = useClient()
    const getWorkerScheduledTasks = useCallback(
        () => client.workers.getWorkerScheduled(timeout, hostname),
        [client, hostname, timeout],
    )
    const result = useQuery({
        queryKey: ["workers/scheduled", hostname],
        queryFn: getWorkerScheduledTasks,
        refetchInterval: interval,
    })

    return { ...result, tasks: result.data?.[hostname] }
}

export default useWorkerScheduledTasks
