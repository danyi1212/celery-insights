import { useClient } from "@hooks/useClient"
import { useQuery } from "@tanstack/react-query"
import { useCallback } from "react"

const useWorkerRevokedTasks = (hostname: string, timeout?: number, interval = 3 * 1000) => {
    const client = useClient()
    const getWorkerRevokedTasks = useCallback(
        () => client.workers.getWorkerRevoked(timeout, hostname),
        [client, hostname, timeout],
    )
    const result = useQuery({
        queryKey: ["workers/revoked", hostname],
        queryFn: getWorkerRevokedTasks,
        refetchInterval: interval,
    })

    return { ...result, tasks: result.data?.[hostname] }
}

export default useWorkerRevokedTasks
