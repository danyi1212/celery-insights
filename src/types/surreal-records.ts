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
  workflow_id?: string | null
  parent_id?: string | null
  children: string[]
  worker?: string | null
  result?: string | null
  result_truncated?: boolean
  exception?: string | null
  traceback?: string | null
}

export interface SurrealWorkflow {
  id: unknown
  root_task_id: string
  root_task_type?: string | null
  aggregate_state: string
  first_seen_at?: string | null
  last_updated?: string | null
  task_count: number
  completed_count: number
  failure_count: number
  retry_count: number
  active_count: number
  worker_count: number
  latest_exception_preview?: string | null
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
  const rawId = colonIdx >= 0 ? str.substring(colonIdx + 1) : str

  // Surreal can serialize record IDs as table:<id> for non-simple IDs.
  // Normalize these wrappers so routing/query bindings always use plain IDs.
  if (rawId.length >= 2) {
    if (
      (rawId.startsWith("<") && rawId.endsWith(">")) ||
      (rawId.startsWith("⟨") && rawId.endsWith("⟩")) ||
      (rawId.startsWith("'") && rawId.endsWith("'")) ||
      (rawId.startsWith('"') && rawId.endsWith('"'))
    ) {
      return rawId.slice(1, -1)
    }
  }

  return rawId
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

// --- Parsed task type (SurrealDB fields with Date objects) ---

const isoToDate = (iso: string | null | undefined): Date | undefined => (iso ? new Date(iso) : undefined)

/** Parsed task — same shape as SurrealTask but with extracted id and Date timestamps */
export interface Task {
  id: string
  type?: string
  state: TaskState
  sent_at: Date
  received_at?: Date
  started_at?: Date
  succeeded_at?: Date
  failed_at?: Date
  retried_at?: Date
  revoked_at?: Date
  rejected_at?: Date
  runtime?: number
  last_updated: Date
  args?: string
  kwargs?: string
  eta?: string
  expires?: string
  retries?: number
  exchange?: string
  routing_key?: string
  root_id?: string
  workflow_id?: string
  parent_id?: string
  children: string[]
  worker?: string
  result?: string
  result_truncated?: boolean
  exception?: string
  traceback?: string
}

export interface Workflow {
  id: string
  root_task_id: string
  root_task_type?: string
  aggregate_state: TaskState
  first_seen_at?: Date
  last_updated?: Date
  task_count: number
  completed_count: number
  failure_count: number
  retry_count: number
  active_count: number
  worker_count: number
  latest_exception_preview?: string
}

/** Convert a raw SurrealDB task record to a parsed Task with Date objects */
export const parseTask = (raw: SurrealTask): Task => ({
  id: extractId(raw.id),
  type: raw.type || undefined,
  state: (raw.state as TaskState) || TaskState.PENDING,
  sent_at: isoToDate(raw.sent_at) || isoToDate(raw.last_updated) || new Date(0),
  received_at: isoToDate(raw.received_at),
  started_at: isoToDate(raw.started_at),
  succeeded_at: isoToDate(raw.succeeded_at),
  failed_at: isoToDate(raw.failed_at),
  retried_at: isoToDate(raw.retried_at),
  revoked_at: isoToDate(raw.revoked_at),
  rejected_at: isoToDate(raw.rejected_at),
  runtime: raw.runtime ?? undefined,
  last_updated: isoToDate(raw.last_updated) || new Date(),
  args: raw.args || undefined,
  kwargs: raw.kwargs || undefined,
  eta: raw.eta || undefined,
  expires: raw.expires || undefined,
  retries: raw.retries ?? undefined,
  exchange: raw.exchange || undefined,
  routing_key: raw.routing_key || undefined,
  root_id: raw.root_id || undefined,
  workflow_id: raw.workflow_id || raw.root_id || extractId(raw.id),
  parent_id: raw.parent_id || undefined,
  children: raw.children,
  worker: raw.worker || undefined,
  result: raw.result || undefined,
  result_truncated: raw.result_truncated,
  exception: raw.exception || undefined,
  traceback: raw.traceback || undefined,
})

export const parseWorkflow = (raw: SurrealWorkflow): Workflow => ({
  id: extractId(raw.id),
  root_task_id: raw.root_task_id,
  root_task_type: raw.root_task_type || undefined,
  aggregate_state: (raw.aggregate_state as TaskState) || TaskState.PENDING,
  first_seen_at: isoToDate(raw.first_seen_at),
  last_updated: isoToDate(raw.last_updated),
  task_count: raw.task_count,
  completed_count: raw.completed_count,
  failure_count: raw.failure_count,
  retry_count: raw.retry_count,
  active_count: raw.active_count,
  worker_count: raw.worker_count,
  latest_exception_preview: raw.latest_exception_preview || undefined,
})
