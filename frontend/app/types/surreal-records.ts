/** SurrealDB record types — these match the schema field names (snake_case). */

/** Task state enum — mirrors Celery task states */
export enum TaskState {
    PENDING = "PENDING",
    RECEIVED = "RECEIVED",
    STARTED = "STARTED",
    SUCCESS = "SUCCESS",
    FAILURE = "FAILURE",
    REVOKED = "REVOKED",
    REJECTED = "REJECTED",
    RETRY = "RETRY",
    IGNORED = "IGNORED",
}

/** Task record as stored in SurrealDB */
export interface SurrealTask {
    id: unknown // SurrealDB RecordId — use String(id) for comparison
    type?: string | null
    state: string
    sent_at?: string | null
    received_at?: string | null
    started_at?: string | null
    succeeded_at?: string | null
    failed_at?: string | null
    retried_at?: string | null
    revoked_at?: string | null
    rejected_at?: string | null
    runtime?: number | null
    last_updated: string
    args?: string | null
    kwargs?: string | null
    eta?: string | null
    expires?: string | null
    retries?: number | null
    exchange?: string | null
    routing_key?: string | null
    root_id?: string | null
    parent_id?: string | null
    children: string[]
    worker?: string | null
    result?: string | null
    result_truncated?: boolean
    exception?: string | null
    traceback?: string | null
}

/** Worker record as stored in SurrealDB */
export interface SurrealWorker {
    id: unknown
    hostname?: string
    pid?: number
    software_identity?: string
    software_version?: string
    software_sys?: string
    active_tasks?: number
    processed_tasks?: number
    last_updated: string
    heartbeat_expires?: string | null
    cpu_load?: [number, number, number]
    status: string
    missed_polls?: number
    /** JSON-encoded inspect data from worker poller (stats, active, registered, etc.) */
    inspect?: string
}

/** Event record as stored in SurrealDB (SCHEMALESS — fields vary by event type) */
export interface SurrealEvent {
    id: unknown
    event_type: string
    task_id?: string
    timestamp: string
    [key: string]: unknown
}

/** Exception summary row from GROUP BY aggregation */
export interface ExceptionSummary {
    exception: string
    count: number
}

/** Extract the plain ID string from a SurrealDB RecordId (e.g. "task:abc123" -> "abc123") */
export const extractId = (recordId: unknown): string => {
    const str = String(recordId)
    const colonIdx = str.indexOf(":")
    return colonIdx >= 0 ? str.substring(colonIdx + 1) : str
}

// --- Worker inspect types (data stored as JSON on worker.inspect field) ---

export interface DeliveryInfo {
    exchange?: string | null
    priority?: number | null
    redelivered?: boolean
    routing_key?: string | null
}

export interface ExchangeInfo {
    name?: string | null
    type?: string | null
}

export interface TaskRequest {
    id: string
    name: string
    type: string
    args: unknown[]
    kwargs: Record<string, unknown>
    delivery_info?: DeliveryInfo
    acknowledged?: boolean
    time_start?: number | null
    hostname: string
    worker_pid?: number | null
}

export interface QueueInfo {
    name?: string | null
    exchange?: ExchangeInfo
    routing_key?: string | null
    queue_arguments?: Record<string, unknown> | null
    binding_arguments?: Record<string, unknown> | null
    consumer_arguments?: Record<string, unknown> | null
    durable?: boolean
    exclusive?: boolean
    auto_delete?: boolean
    no_ack?: boolean
    alias?: string | null
    message_ttl?: number | null
    max_length?: number | null
    max_priority?: number | null
}

export interface ScheduledTask {
    eta: string
    priority: number
    request: TaskRequest
}

/** Parsed worker inspect data from the worker poller */
export interface WorkerInspectData {
    stats?: Record<string, unknown>
    active?: TaskRequest[]
    registered?: string[]
    scheduled?: ScheduledTask[]
    reserved?: TaskRequest[]
    active_queues?: QueueInfo[]
}

/** Parse the JSON inspect field from a SurrealWorker record */
export const parseWorkerInspect = (worker: SurrealWorker | null): WorkerInspectData | null => {
    if (!worker?.inspect) return null
    try {
        return typeof worker.inspect === "string" ? JSON.parse(worker.inspect) : worker.inspect
    } catch {
        return null
    }
}
