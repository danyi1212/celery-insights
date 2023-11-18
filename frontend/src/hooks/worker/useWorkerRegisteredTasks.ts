import { useClient } from "@hooks/useClient"
import { useQuery } from "@tanstack/react-query"
import { useCallback } from "react"

const useWorkerRegisteredTasks = (hostname: string, timeout?: number, interval = 60 * 1000) => {
    const client = useClient()
    const getWorkerRegisteredTasks = useCallback(
        () => client.workers.getWorkerRegistered(timeout, hostname),
        [client, hostname, timeout],
    )
    const result = useQuery({
        queryKey: ["workers/registered", hostname],
        queryFn: getWorkerRegisteredTasks,
        refetchInterval: interval,
    })

    return { ...result, tasks: result.data?.[hostname] }
}

export default useWorkerRegisteredTasks
