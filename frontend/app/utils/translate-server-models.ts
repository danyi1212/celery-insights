import { Task as ServerTask, TaskState, Worker as ServerWorker } from "@services/server"
import type { SurrealTask, SurrealWorker } from "@/types/surreal-records"

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

const timestampToDate = (timestamp: number): Date => new Date(timestamp * 1000)

export const translateTask = (task: ServerTask): StateTask => ({
    id: task.id,
    type: task.type || undefined,
    state: task.state,
    sentAt: timestampToDate(task.sent_at),
    receivedAt: task.received_at ? timestampToDate(task.received_at) : undefined,
    startedAt: task.started_at ? timestampToDate(task.started_at) : undefined,
    succeededAt: task.succeeded_at ? timestampToDate(task.succeeded_at) : undefined,
    failedAt: task.failed_at ? timestampToDate(task.failed_at) : undefined,
    retriedAt: task.retried_at ? timestampToDate(task.retried_at) : undefined,
    revokedAt: task.revoked_at ? timestampToDate(task.revoked_at) : undefined,
    rejectedAt: task.rejected_at ? timestampToDate(task.rejected_at) : undefined,
    runtime: task.runtime ?? undefined,
    lastUpdated: timestampToDate(task.last_updated),
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

export const translateWorker = (worker: ServerWorker): StateWorker => ({
    id: worker.id,
    hostname: worker.hostname,
    pid: worker.pid,
    softwareIdentity: worker.software_identity,
    softwareVersion: worker.software_version,
    softwareSys: worker.software_sys,
    activeTasks: worker.active_tasks,
    processedTasks: worker.processed_tasks,
    lastUpdated: timestampToDate(worker.last_updated),
    heartbeatExpires: worker.heartbeat_expires ? timestampToDate(worker.heartbeat_expires) : undefined,
    cpuLoad: worker.cpu_load as [number, number, number],
})

/** Extract the plain ID string from a SurrealDB RecordId (e.g. "task:abc123" → "abc123") */
export const extractId = (recordId: unknown): string => {
    const str = String(recordId)
    const colonIdx = str.indexOf(":")
    return colonIdx >= 0 ? str.substring(colonIdx + 1) : str
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
export const surrealToStateWorker = (task: SurrealWorker): StateWorker => ({
    id: extractId(task.id),
    hostname: task.hostname || "",
    pid: task.pid || 0,
    softwareIdentity: task.software_identity || "",
    softwareVersion: task.software_version || "",
    softwareSys: task.software_sys || "",
    activeTasks: task.active_tasks || 0,
    processedTasks: task.processed_tasks || 0,
    lastUpdated: isoToDate(task.last_updated) || new Date(),
    heartbeatExpires: isoToDate(task.heartbeat_expires),
    cpuLoad: task.cpu_load,
})
