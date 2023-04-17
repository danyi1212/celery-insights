import { ServerClient } from "@services/server"
import { useCallback } from "react"
import { useQuery } from "react-query"

const useWorkerReservedTasks = (hostname: string, timeout?: number, interval = 1000) => {
    const getWorkerReservedTasks = useCallback(
        () => new ServerClient().workers.getWorkerReserved(timeout, hostname),
        [hostname, timeout]
    )
    const result = useQuery(["workers/reserved", hostname], getWorkerReservedTasks, {
        refetchInterval: interval,
    })

    return { ...result, tasks: result.data?.[hostname] }
}

export default useWorkerReservedTasks
