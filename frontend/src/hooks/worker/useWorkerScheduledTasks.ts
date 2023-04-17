import { ServerClient } from "@services/server"
import { useCallback } from "react"
import { useQuery } from "react-query"

const useWorkerScheduledTasks = (hostname: string, timeout?: number, interval = 1000) => {
    const getWorkerScheduledTasks = useCallback(
        () => new ServerClient().workers.getWorkerScheduled(timeout, hostname),
        [hostname, timeout]
    )
    const result = useQuery(["workers/scheduled", hostname], getWorkerScheduledTasks, {
        refetchInterval: interval,
    })

    return { ...result, tasks: result.data?.[hostname] }
}

export default useWorkerScheduledTasks
