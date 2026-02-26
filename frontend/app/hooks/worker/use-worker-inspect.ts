import { useWorker } from "@hooks/use-live-workers"
import type { QueueInfo, ScheduledTask, TaskRequest } from "@/types/surreal-records"
import { parseWorkerInspect } from "@/types/surreal-records"
import { useMemo } from "react"

/**
 * Access parsed inspect data from a SurrealDB worker record.
 * Replaces the old per-endpoint hooks (useWorkerStats, useWorkerActiveTasks, etc.)
 * that called the REST API. The worker poller now stores all inspect data as a JSON
 * field on the worker record in SurrealDB.
 */
export const useWorkerInspect = (workerId: string) => {
    const { worker, isLoading, error } = useWorker(workerId)
    const inspect = useMemo(() => parseWorkerInspect(worker), [worker])
    return { worker, inspect, isLoading, error }
}

export const useWorkerStats = (workerId: string) => {
    const { inspect, isLoading, error } = useWorkerInspect(workerId)
    return {
        stats: inspect?.stats as
            | (Record<string, unknown> & {
                  pool?: {
                      processes?: number[]
                      "max-concurrency"?: number
                      "max-tasks-per-child"?: number
                      timeouts?: [number, number]
                  }
                  broker?: {
                      hostname?: string
                      port?: number
                      transport?: string
                      userid?: string
                      ssl?: boolean
                      connection_timeout?: number
                      heartbeat?: number
                      login_method?: string
                  }
                  uptime?: number
                  rusage?: { maxrss?: number }
                  total?: Record<string, number>
              })
            | undefined,
        isLoading,
        error,
    }
}

export const useWorkerActiveTasks = (workerId: string) => {
    const { inspect, isLoading, error } = useWorkerInspect(workerId)
    return { tasks: inspect?.active as TaskRequest[] | undefined, isLoading, error }
}

export const useWorkerRegisteredTasks = (workerId: string) => {
    const { inspect, isLoading, error } = useWorkerInspect(workerId)
    return { tasks: inspect?.registered as string[] | undefined, isLoading, error }
}

export const useWorkerScheduledTasks = (workerId: string) => {
    const { inspect, isLoading, error } = useWorkerInspect(workerId)
    return { tasks: inspect?.scheduled as ScheduledTask[] | undefined, isLoading, error }
}

export const useWorkerReservedTasks = (workerId: string) => {
    const { inspect, isLoading, error } = useWorkerInspect(workerId)
    return { tasks: inspect?.reserved as TaskRequest[] | undefined, isLoading, error }
}

export const useWorkerQueues = (workerId: string) => {
    const { inspect, isLoading, error } = useWorkerInspect(workerId)
    return { queues: inspect?.active_queues as QueueInfo[] | undefined, isLoading, error }
}

export const useWorkerRevokedTasks = (workerId: string) => {
    const { inspect, isLoading, error } = useWorkerInspect(workerId)
    const revoked = useMemo(() => {
        const stats = inspect?.stats as Record<string, unknown> | undefined
        const revokedList = stats?.revoked as string[] | undefined
        return revokedList
    }, [inspect])
    return { tasks: revoked, isLoading, error }
}
