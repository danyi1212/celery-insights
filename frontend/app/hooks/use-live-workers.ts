import { useCallback, useMemo } from "react"
import { RecordId } from "surrealdb"
import { useLiveQuery } from "./use-live-query"
import { extractId, type SurrealWorker } from "@/types/surreal-records"

const byLastUpdatedDesc = (a: SurrealWorker, b: SurrealWorker) =>
    new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()

const isOnline = (w: SurrealWorker) => w.status === "online"

/** All workers ordered by last_updated descending. */
export const useLiveWorkers = () =>
    useLiveQuery<SurrealWorker>({
        initialQuery: "SELECT * FROM worker ORDER BY last_updated DESC",
        liveTable: "worker",
        orderBy: byLastUpdatedDesc,
    })

/** Single worker detail by ID. */
export const useWorker = (workerId: string) => {
    const bindings = useMemo(() => ({ rid: new RecordId("worker", workerId) }), [workerId])
    const filter = useCallback((w: SurrealWorker) => extractId(w.id) === workerId, [workerId])

    const result = useLiveQuery<SurrealWorker>({
        initialQuery: "SELECT * FROM $rid",
        liveTable: "worker",
        bindings,
        filter,
        enabled: !!workerId,
    })

    return {
        ...result,
        worker: result.data[0] ?? null,
    }
}

/** Online workers only — filtered by status field set by the backend poller. */
export const useOnlineWorkers = () =>
    useLiveQuery<SurrealWorker>({
        initialQuery: "SELECT * FROM worker WHERE status = 'online' ORDER BY last_updated DESC",
        liveTable: "worker",
        orderBy: byLastUpdatedDesc,
        filter: isOnline,
    })
