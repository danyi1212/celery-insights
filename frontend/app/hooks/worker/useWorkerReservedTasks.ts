import { useClient } from "@hooks/useClient"
import { useQuery } from "@tanstack/react-query"
import { useCallback } from "react"

const useWorkerReservedTasks = (hostname: string, timeout?: number, interval = 1000) => {
    const client = useClient()
    const getWorkerReservedTasks = useCallback(
        () => client.workers.getWorkerReserved(timeout, hostname),
        [client, hostname, timeout],
    )
    const result = useQuery({
        queryKey: ["workers/reserved", hostname],
        queryFn: getWorkerReservedTasks,
        refetchInterval: interval,
    })

    return { ...result, tasks: result.data?.[hostname] }
}

export default useWorkerReservedTasks
