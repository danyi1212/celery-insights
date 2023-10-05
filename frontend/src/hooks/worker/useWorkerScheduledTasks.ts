import { useClient } from "@hooks/useClient"
import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"

const useWorkerScheduledTasks = (hostname: string, timeout?: number, interval = 1000) => {
    const client = useClient()
    const getWorkerScheduledTasks = useCallback(
        () => client.workers.getWorkerScheduled(timeout, hostname),
        [client, hostname, timeout],
    )
    const result = useQuery(["workers/scheduled", hostname], getWorkerScheduledTasks, {
        refetchInterval: interval,
    })

    return { ...result, tasks: result.data?.[hostname] }
}

export default useWorkerScheduledTasks
