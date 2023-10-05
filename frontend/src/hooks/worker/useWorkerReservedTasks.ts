import { useClient } from "@hooks/useClient"
import { useCallback } from "react"
import { useQuery } from "react-query"

const useWorkerReservedTasks = (hostname: string, timeout?: number, interval = 1000) => {
    const client = useClient()
    const getWorkerReservedTasks = useCallback(
        () => client.workers.getWorkerReserved(timeout, hostname),
        [client, hostname, timeout],
    )
    const result = useQuery(["workers/reserved", hostname], getWorkerReservedTasks, {
        refetchInterval: interval,
    })

    return { ...result, tasks: result.data?.[hostname] }
}

export default useWorkerReservedTasks
