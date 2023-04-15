import { ServerClient } from "@services/server"
import { StateWorker } from "@utils/translateServerModels"
import { useCallback } from "react"
import { useQuery } from "react-query"

const useWorkerRegisteredTasks = (worker: StateWorker, timeout?: number) => {
    const getWorkerRegisteredTasks = useCallback(
        () => new ServerClient().workers.getWorkerRegistered(timeout, worker?.hostname),
        [worker, timeout]
    )
    const result = useQuery(["workers/registered", worker.hostname], getWorkerRegisteredTasks, {
        refetchInterval: 5000,
    })

    return { ...result, tasks: result.data?.[worker.hostname] }
}

export default useWorkerRegisteredTasks
