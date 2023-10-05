import { useClient } from "@hooks/useClient"
import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"

const useWorkerRegisteredTasks = (hostname: string, timeout?: number, interval = 60 * 1000) => {
    const client = useClient()
    const getWorkerRegisteredTasks = useCallback(
        () => client.workers.getWorkerRegistered(timeout, hostname),
        [client, hostname, timeout],
    )
    const result = useQuery(["workers/registered", hostname], getWorkerRegisteredTasks, {
        refetchInterval: interval,
    })

    return { ...result, tasks: result.data?.[hostname] }
}

export default useWorkerRegisteredTasks
