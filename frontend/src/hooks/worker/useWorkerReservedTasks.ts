import { ServerClient } from "@services/server"
import { StateWorker } from "@utils/translateServerModels"
import { useCallback } from "react"
import { useQuery } from "react-query"

const useWorkerReservedTasks = (worker: StateWorker, timeout?: number) => {
    const getWorkerReservedTasks = useCallback(
        () => new ServerClient().workers.getWorkerReserved(timeout, worker?.hostname),
        [worker, timeout]
    )
    const result = useQuery(["workers/reserved", worker.hostname], getWorkerReservedTasks, {
        refetchInterval: 1000,
    })

    return { ...result, tasks: result.data?.[worker.hostname] }
}

export default useWorkerReservedTasks
