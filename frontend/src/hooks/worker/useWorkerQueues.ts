import { ServerClient } from "@services/server"
import { useCallback } from "react"
import { useQuery } from "react-query"

const useWorkerQueues = (hostname: string, timeout?: number, interval = 15 * 1000) => {
    const getWorkerQueues = useCallback(
        () => new ServerClient().workers.getWorkerQueues(timeout, hostname),
        [hostname, timeout]
    )
    const result = useQuery(["workers/queues", hostname], getWorkerQueues, { refetchInterval: interval })

    return { ...result, queues: result.data?.[hostname] }
}

export default useWorkerQueues
