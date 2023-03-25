import { Task as ServerTask, TaskState, Worker as ServerWorker } from "@services/server"

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

export const translateTask = (task: ServerTask): StateTask => ({
    id: task.id,
    type: task.type,
    state: task.state,
    sentAt: new Date(task.sent_at),
    receivedAt: task.received_at ? new Date(task.received_at) : undefined,
    startedAt: task.started_at ? new Date(task.started_at) : undefined,
    succeededAt: task.succeeded_at ? new Date(task.succeeded_at) : undefined,
    failedAt: task.failed_at ? new Date(task.failed_at) : undefined,
    retriedAt: task.retried_at ? new Date(task.retried_at) : undefined,
    revokedAt: task.revoked_at ? new Date(task.revoked_at) : undefined,
    rejectedAt: task.rejected_at ? new Date(task.rejected_at) : undefined,
    runtime: task.runtime,
    lastUpdated: new Date(task.last_updated),
    args: task.args,
    kwargs: task.kwargs,
    eta: task.eta,
    expires: task.expires,
    retries: task.retries,
    exchange: task.exchange,
    routingKey: task.routing_key,
    rootId: task.root_id,
    parentId: task.parent_id,
    children: task.children,
    worker: task.worker,
    result: task.result,
    exception: task.exception,
    traceback: task.traceback,
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
    lastUpdated: new Date(worker.last_updated),
    heartbeatExpires: worker.heartbeat_expires ? new Date(worker.heartbeat_expires) : undefined,
    cpuLoad: worker.cpu_load as [number, number, number],
})
