import { ServerClient } from "@services/server"
import { useCallback } from "react"
import { useQuery } from "react-query"

const useWorkerStats = (hostname: string, timeout?: number, interval = 5 * 1000) => {
    const getWorkerStats = useCallback(
        () => new ServerClient().workers.getWorkerStats(timeout, hostname),
        [hostname, timeout]
    )
    const result = useQuery(["workers/stats", hostname], getWorkerStats, { refetchInterval: interval })

    return { ...result, stats: result.data?.[hostname] }
}

export default useWorkerStats
