import { useClient } from "@hooks/useClient"
import { useCallback } from "react"
import { useQuery } from "react-query"

const useWorkerRevokedTasks = (hostname: string, timeout?: number, interval = 3 * 1000) => {
    const client = useClient()
    const getWorkerRevokedTasks = useCallback(
        () => client.workers.getWorkerRevoked(timeout, hostname),
        [client, hostname, timeout]
    )
    const result = useQuery(["workers/revoked", hostname], getWorkerRevokedTasks, {
        refetchInterval: interval,
    })

    return { ...result, tasks: result.data?.[hostname] }
}

export default useWorkerRevokedTasks
