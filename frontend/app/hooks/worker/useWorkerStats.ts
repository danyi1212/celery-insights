import { useClient } from "@hooks/useClient"
import { useQuery } from "@tanstack/react-query"
import { useCallback } from "react"

const useWorkerStats = (hostname: string, timeout?: number, interval = 5 * 1000) => {
    const client = useClient()
    const getWorkerStats = useCallback(
        () => client.workers.getWorkerStats(timeout, hostname),
        [client, hostname, timeout],
    )
    const result = useQuery({
        queryKey: ["workers/stats", hostname],
        queryFn: getWorkerStats,
        refetchInterval: interval,
    })

    return { ...result, stats: result.data?.[hostname] }
}

export default useWorkerStats
