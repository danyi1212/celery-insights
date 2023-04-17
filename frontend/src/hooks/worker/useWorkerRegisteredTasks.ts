import { ServerClient } from "@services/server"
import { useCallback } from "react"
import { useQuery } from "react-query"

const useWorkerRegisteredTasks = (hostname: string, timeout?: number, interval = 60 * 1000) => {
    const getWorkerRegisteredTasks = useCallback(
        () => new ServerClient().workers.getWorkerRegistered(timeout, hostname),
        [hostname, timeout]
    )
    const result = useQuery(["workers/registered", hostname], getWorkerRegisteredTasks, {
        refetchInterval: interval,
    })

    return { ...result, tasks: result.data?.[hostname] }
}

export default useWorkerRegisteredTasks
