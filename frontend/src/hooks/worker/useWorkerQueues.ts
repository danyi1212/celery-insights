import { useClient } from "@hooks/useClient"
import { useCallback } from "react"
import { useQuery } from "react-query"

const useWorkerQueues = (hostname: string, timeout?: number, interval = 15 * 1000) => {
    const client = useClient()
    const getWorkerQueues = useCallback(
        () => client.workers.getWorkerQueues(timeout, hostname),
        [client, hostname, timeout]
    )
    const result = useQuery(["workers/queues", hostname], getWorkerQueues, { refetchInterval: interval })

    return { ...result, queues: result.data?.[hostname] }
}

export default useWorkerQueues
