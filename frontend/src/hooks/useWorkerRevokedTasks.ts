import { ServerClient } from "@services/server"
import { StateWorker } from "@utils/translateServerModels"
import { useCallback } from "react"
import { useQuery } from "react-query"

const useWorkerRevokedTasks = (worker: StateWorker, timeout?: number) => {
    const getWorkerRevokedTasks = useCallback(
        () => new ServerClient().workers.getWorkerRevoked(timeout, worker?.hostname),
        [worker, timeout]
    )
    const result = useQuery(["workers/revoked", worker.hostname], getWorkerRevokedTasks, {
        refetchInterval: 5000,
    })

    return { ...result, tasks: result.data?.[worker.hostname] }
}

export default useWorkerRevokedTasks
