import { useClient } from "@hooks/useClient"
import { useCallback } from "react"
import { useQuery } from "react-query"

const useWorkerActiveTasks = (hostname: string, timeout?: number, interval = 1000) => {
    const client = useClient()
    const getWorkerActiveTasks = useCallback(
        () => client.workers.getWorkerActive(timeout, hostname),
        [client, hostname, timeout]
    )
    const result = useQuery(["workers/active", hostname], getWorkerActiveTasks, {
        refetchInterval: interval,
    })

    return { ...result, tasks: result.data?.[hostname] }
}

export default useWorkerActiveTasks
