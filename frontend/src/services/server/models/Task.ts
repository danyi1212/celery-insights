/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { TaskState } from './TaskState';

export type Task = {
    /**
     * Task UUID
     */
    id: string;
    /**
     * Task function name
     */
    type?: (string | null);
    /**
     * Task last known state
     */
    state: TaskState;
    /**
     * When task was published by client to queue
     */
    sent_at: number;
    /**
     * When task was received by worker
     */
    received_at?: (number | null);
    /**
     * When task was started to be executed by worker
     */
    started_at?: (number | null);
    /**
     * When task was finished successfully by worker
     */
    succeeded_at?: (number | null);
    /**
     * When task was finished with failure by worker
     */
    failed_at?: (number | null);
    /**
     * When task was last published for retry
     */
    retried_at?: (number | null);
    /**
     * When task was revoked last
     */
    revoked_at?: (number | null);
    /**
     * When task was rejected by worker
     */
    rejected_at?: (number | null);
    /**
     * How long task executed in seconds
     */
    runtime?: (number | null);
    /**
     * When task last event published
     */
    last_updated: number;
    /**
     * Positional arguments provided to task (truncated)
     */
    args?: (string | null);
    /**
     * Keyword arguments provided to task (truncated)
     */
    kwargs?: (string | null);
    /**
     * Absolute time when task should be executed
     */
    eta?: (string | null);
    /**
     * Absolute time when task should be expired
     */
    expires?: (string | null);
    /**
     * Retry count
     */
    retries?: (number | null);
    /**
     * Broker exchange name
     */
    exchange?: (string | null);
    /**
     * Broker routing key
     */
    routing_key?: (string | null);
    /**
     * Root Task ID
     */
    root_id?: (string | null);
    /**
     * Parent Task ID
     */
    parent_id?: (string | null);
    /**
     * Children Task IDs
     */
    children: Array<string>;
    /**
     * Executing worker hostname
     */
    worker?: (string | null);
    /**
     * Task returned result
     */
    result?: (string | null);
    /**
     * Task failure exception message
     */
    exception?: (string | null);
    /**
     * Task failure traceback
     */
    traceback?: (string | null);
};

