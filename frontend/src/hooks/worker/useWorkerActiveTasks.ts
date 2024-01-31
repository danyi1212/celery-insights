import { useClient } from "@hooks/useClient"
import { useQuery } from "@tanstack/react-query"
import { useCallback } from "react"

const useWorkerActiveTasks = (hostname: string, timeout?: number, interval = 1000) => {
    const client = useClient()
    const getWorkerActiveTasks = useCallback(
        () => client.workers.getWorkerActive(timeout, hostname),
        [client, hostname, timeout],
    )
    const result = useQuery({
        queryKey: ["workers/active", hostname],
        queryFn: getWorkerActiveTasks,
        refetchInterval: interval,
    })

    return { ...result, tasks: result.data?.[hostname] }
}

export default useWorkerActiveTasks
