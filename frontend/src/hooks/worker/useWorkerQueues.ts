import { ServerClient } from "@services/server"
import { StateWorker } from "@utils/translateServerModels"
import { useCallback } from "react"
import { useQuery } from "react-query"

const useWorkerQueues = (worker: StateWorker, timeout?: number) => {
    const getWorkerQueues = useCallback(
        () => new ServerClient().workers.getWorkerQueues(timeout, worker?.hostname),
        [worker, timeout]
    )
    const result = useQuery(["workers/queues", worker.hostname], getWorkerQueues, { refetchInterval: 5000 })

    return { ...result, queues: result.data?.[worker.hostname] }
}

export default useWorkerQueues
