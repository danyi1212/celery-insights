import { useMemo } from "react"
import { useLiveQuery } from "./use-live-query"
import type { SurrealWorker } from "@/types/surreal-records"

const byLastUpdatedDesc = (a: SurrealWorker, b: SurrealWorker) =>
    new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()

/** All workers ordered by last_updated descending. */
export const useLiveWorkers = () =>
    useLiveQuery<SurrealWorker>({
        initialQuery: "SELECT * FROM worker ORDER BY last_updated DESC",
        liveTable: "worker",
        orderBy: byLastUpdatedDesc,
    })

/** Single worker detail by ID. */
export const useWorker = (workerId: string) => {
    const bindings = useMemo(() => ({ workerId }), [workerId])

    const result = useLiveQuery<SurrealWorker>({
        initialQuery: "SELECT * FROM type::thing('worker', $workerId)",
        liveTable: "worker",
        bindings,
        enabled: !!workerId,
    })

    return {
        ...result,
        worker: result.data[0] ?? null,
    }
}

/** Online workers only — filtered by status field set by the backend poller. */
export const useOnlineWorkers = () => {
    const result = useLiveQuery<SurrealWorker>({
        initialQuery: "SELECT * FROM worker WHERE status = 'online' ORDER BY last_updated DESC",
        liveTable: "worker",
        orderBy: byLastUpdatedDesc,
    })

    // Client-side filter: live notifications include all worker records,
    // so we filter to only include those with status = "online"
    const onlineData = useMemo(() => result.data.filter((w) => w.status === "online"), [result.data])

    return {
        ...result,
        data: onlineData,
    }
}
