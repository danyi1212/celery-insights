import { ServerClient } from "@services/server"
import { StateWorker } from "@utils/translateServerModels"
import { useCallback } from "react"
import { useQuery } from "react-query"

const useWorkerActiveTasks = (worker: StateWorker, timeout?: number) => {
    const getWorkerActiveTasks = useCallback(
        () => new ServerClient().workers.getWorkerActive(timeout, worker?.hostname),
        [worker, timeout]
    )
    const result = useQuery(["workers/active", worker.hostname], getWorkerActiveTasks, {
        refetchInterval: 1000,
    })

    return { ...result, tasks: result.data?.[worker.hostname] }
}

export default useWorkerActiveTasks
