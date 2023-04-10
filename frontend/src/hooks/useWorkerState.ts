import { ServerClient } from "@services/server"
import { StateWorker } from "@utils/translateServerModels"
import { useCallback } from "react"
import { useQuery } from "react-query"

const useWorkerState = (worker: StateWorker, timeout?: number) => {
    const getWorkerStats = useCallback(
        () => new ServerClient().workers.getWorkerStats(timeout, worker?.hostname),
        [worker, timeout]
    )
    const result = useQuery(["workers/stats", worker.hostname], getWorkerStats)

    return { ...result, stats: result.data?.[worker.hostname] }
}

export default useWorkerState
