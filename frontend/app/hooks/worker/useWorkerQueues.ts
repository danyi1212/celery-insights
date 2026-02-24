import { useClient } from "@hooks/useClient"
import { useQuery } from "@tanstack/react-query"
import { useCallback } from "react"

const useWorkerQueues = (hostname: string, timeout?: number, interval = 15 * 1000) => {
    const client = useClient()
    const getWorkerQueues = useCallback(
        () => client.workers.getWorkerQueues(timeout, hostname),
        [client, hostname, timeout],
    )
    const result = useQuery({
        queryKey: ["workers/queues", hostname],
        queryFn: getWorkerQueues,
        refetchInterval: interval,
    })

    return { ...result, queues: result.data?.[hostname] }
}

export default useWorkerQueues
