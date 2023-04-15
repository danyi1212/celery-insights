import { ServerClient } from "@services/server"
import { StateWorker } from "@utils/translateServerModels"
import { useCallback } from "react"
import { useQuery } from "react-query"

const useWorkerScheduledTasks = (worker: StateWorker, timeout?: number) => {
    const getWorkerScheduledTasks = useCallback(
        () => new ServerClient().workers.getWorkerScheduled(timeout, worker?.hostname),
        [worker, timeout]
    )
    const result = useQuery(["workers/scheduled", worker.hostname], getWorkerScheduledTasks, {
        refetchInterval: 1000,
    })

    return { ...result, tasks: result.data?.[worker.hostname] }
}

export default useWorkerScheduledTasks
