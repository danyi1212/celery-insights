import { useClient } from "@hooks/useClient"
import { useCallback } from "react"
import { useQuery } from "react-query"

const useWorkerStats = (hostname: string, timeout?: number, interval = 5 * 1000) => {
    const client = useClient()
    const getWorkerStats = useCallback(
        () => client.workers.getWorkerStats(timeout, hostname),
        [client, hostname, timeout]
    )
    const result = useQuery(["workers/stats", hostname], getWorkerStats, { refetchInterval: interval })

    return { ...result, stats: result.data?.[hostname] }
}

export default useWorkerStats
