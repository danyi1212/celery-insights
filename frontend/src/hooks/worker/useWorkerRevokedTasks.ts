import { ServerClient } from "@services/server"
import { useCallback } from "react"
import { useQuery } from "react-query"

const useWorkerRevokedTasks = (hostname: string, timeout?: number, interval = 3 * 1000) => {
    const getWorkerRevokedTasks = useCallback(
        () => new ServerClient().workers.getWorkerRevoked(timeout, hostname),
        [hostname, timeout]
    )
    const result = useQuery(["workers/revoked", hostname], getWorkerRevokedTasks, {
        refetchInterval: interval,
    })

    return { ...result, tasks: result.data?.[hostname] }
}

export default useWorkerRevokedTasks
