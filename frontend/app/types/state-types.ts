/**
 * Legacy state types — bridge between SurrealDB records and the existing UI components.
 * These will be removed once components are updated to use SurrealTask/SurrealWorker directly (Task 3h).
 */
import type { SurrealTask, SurrealWorker } from "@/types/surreal-records"
import { TaskState, extractId } from "@/types/surreal-records"

export interface StateTask {
    id: string
    type?: string
    state: TaskState
    sentAt: Date
    receivedAt?: Date
    startedAt?: Date
    succeededAt?: Date
    failedAt?: Date
    retriedAt?: Date
    revokedAt?: Date
    rejectedAt?: Date
    runtime?: number
    lastUpdated: Date
    args?: string
    kwargs?: string
    eta?: string
    expires?: string
    retries?: number
    exchange?: string
    routingKey?: string
    rootId?: string
    parentId?: string
    children: string[]
    worker?: string
    result?: string
    exception?: string
    traceback?: string
}

export interface StateWorker {
    id: string
    hostname: string
    pid: number
    softwareIdentity: string
    softwareVersion: string
    softwareSys: string
    activeTasks: number
    processedTasks: number
    lastUpdated: Date
    heartbeatExpires?: Date
    cpuLoad?: [number, number, number]
}

const isoToDate = (iso: string | null | undefined): Date | undefined => (iso ? new Date(iso) : undefined)

/** Convert a SurrealDB task record to the legacy StateTask format used by UI components */
export const surrealToStateTask = (task: SurrealTask): StateTask => ({
    id: extractId(task.id),
    type: task.type || undefined,
    state: (task.state as TaskState) || TaskState.PENDING,
    sentAt: isoToDate(task.sent_at) || new Date(),
    receivedAt: isoToDate(task.received_at),
    startedAt: isoToDate(task.started_at),
    succeededAt: isoToDate(task.succeeded_at),
    failedAt: isoToDate(task.failed_at),
    retriedAt: isoToDate(task.retried_at),
    revokedAt: isoToDate(task.revoked_at),
    rejectedAt: isoToDate(task.rejected_at),
    runtime: task.runtime ?? undefined,
    lastUpdated: isoToDate(task.last_updated) || new Date(),
    args: task.args || undefined,
    kwargs: task.kwargs || undefined,
    eta: task.eta || undefined,
    expires: task.expires || undefined,
    retries: task.retries ?? undefined,
    exchange: task.exchange || undefined,
    routingKey: task.routing_key || undefined,
    rootId: task.root_id || undefined,
    parentId: task.parent_id || undefined,
    children: task.children,
    worker: task.worker || undefined,
    result: task.result || undefined,
    exception: task.exception || undefined,
    traceback: task.traceback || undefined,
})

/** Convert a SurrealDB worker record to the legacy StateWorker format used by UI components */
export const surrealToStateWorker = (worker: SurrealWorker): StateWorker => ({
    id: extractId(worker.id),
    hostname: worker.hostname || "",
    pid: worker.pid || 0,
    softwareIdentity: worker.software_identity || "",
    softwareVersion: worker.software_version || "",
    softwareSys: worker.software_sys || "",
    activeTasks: worker.active_tasks || 0,
    processedTasks: worker.processed_tasks || 0,
    lastUpdated: isoToDate(worker.last_updated) || new Date(),
    heartbeatExpires: isoToDate(worker.heartbeat_expires),
    cpuLoad: worker.cpu_load,
})
