/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { TaskState } from './TaskState';

export type TaskResult = {
    /**
     * Task ID
     */
    id: string;
    /**
     * Task type name
     */
    type?: (string | null);
    /**
     * Task current state
     */
    state: TaskState;
    /**
     * Task queue name
     */
    queue?: (string | null);
    /**
     * Task return value or exception
     */
    result?: null;
    /**
     * Task exception traceback
     */
    traceback?: (string | null);
    /**
     * Task result is ignored
     */
    ignored: boolean;
    /**
     * Task positional arguments
     */
    args: Array<any>;
    /**
     * Task keyword arguments
     */
    kwargs: Record<string, any>;
    /**
     * Task retries count
     */
    retries: number;
    /**
     * Executing worker id
     */
    worker?: (string | null);
};

