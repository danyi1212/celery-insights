/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

/**
 * An enumeration.
 */
export enum EventType {
    TASK_SENT = "task-sent",
    TASK_RECEIVED = "task-received",
    TASK_STARTED = "task-started",
    TASK_SUCCEEDED = "task-succeeded",
    TASK_FAILED = "task-failed",
    TASK_REJECTED = "task-rejected",
    TASK_REVOKED = "task-revoked",
    TASK_RETRIED = "task-retried",
    WORKER_ONLINE = "worker-online",
    WORKER_HEARTBEAT = "worker-heartbeat",
    WORKER_OFFLINE = "worker-offline",
}
