/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type {TaskState} from "./TaskState"

export type TaskResult = {
    /**
     * Task ID
     */
    id: string
    /**
     * Task type name
     */
    type?: string
    /**
     * Task current state
     */
    state: TaskState
    /**
     * Task queue name
     */
    queue?: string
    /**
     * Task return value or exception
     */
    result?: any
    /**
     * Task exception traceback
     */
    traceback?: string
    /**
     * Task result is ignored
     */
    ignored: boolean
    /**
     * Task positional arguments
     */
    args: Array<any>
    /**
     * Task keyword arguments
     */
    kwargs: any
    /**
     * Task retries count
     */
    retries: number
    /**
     * Executing worker id
     */
    worker?: string
}
