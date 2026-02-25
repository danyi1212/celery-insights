/** SurrealDB record types — these match the schema field names (snake_case). */

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
