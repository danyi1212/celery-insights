import { ServerClient } from "@services/server"
import { useCallback } from "react"
import { useQuery } from "react-query"

const useWorkerActiveTasks = (hostname: string, timeout?: number, interval = 1000) => {
    const getWorkerActiveTasks = useCallback(
        () => new ServerClient().workers.getWorkerActive(timeout, hostname),
        [hostname, timeout]
    )
    const result = useQuery(["workers/active", hostname], getWorkerActiveTasks, {
        refetchInterval: interval,
    })

    return { ...result, tasks: result.data?.[hostname] }
}

export default useWorkerActiveTasks
