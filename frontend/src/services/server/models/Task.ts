/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type {TaskState} from "./TaskState"

export type Task = {
    /**
     * Task UUID
     */
    id: string
    /**
     * Task function name
     */
    type?: string
    /**
     * Task last known state
     */
    state: TaskState
    /**
     * When task was published by client to queue
     */
    sent_at?: string
    /**
     * When task was received by worker
     */
    received_at?: string
    /**
     * When task was started to be executed by worker
     */
    started_at?: string
    /**
     * When task was finished successfully by worker
     */
    succeeded_at?: string
    /**
     * When task was finished with failure by worker
     */
    failed_at?: string
    /**
     * When task was last published for retry
     */
    retried_at?: string
    /**
     * When task was revoked last
     */
    revoked_at?: string
    /**
     * When task was rejected by worker
     */
    rejected_at?: string
    /**
     * How long task executed in seconds
     */
    runtime?: number
    /**
     * Positional arguments provided to task
     */
    args: string
    /**
     * Keyword arguments provided to task
     */
    kwargs: string
    /**
     * Absolute time when task should be executed
     */
    eta?: string
    /**
     * Absolute time when task should be expired
     */
    expires?: string
    /**
     * Retry count
     */
    retries?: number
    /**
     * Broker exchange name
     */
    exchange?: string
    /**
     * Broker routing key
     */
    routing_key?: string
    /**
     * Root Task ID
     */
    root_id?: string
    /**
     * Parent Task ID
     */
    parent_id?: string
    /**
     * Children Task IDs
     */
    children: Array<string>
    /**
     * Executing worker hostname
     */
    worker?: string
    /**
     * Task returned result
     */
    result?: string
    /**
     * Task failure exception message
     */
    exception?: string
    /**
     * Task failure traceback
     */
    traceback?: string
}
