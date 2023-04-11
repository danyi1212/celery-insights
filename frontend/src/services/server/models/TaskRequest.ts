/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type {DeliveryInfo} from "./DeliveryInfo"

export type TaskRequest = {
    /**
     * Task unique id
     */
    id: string
    /**
     * Task name
     */
    name: string
    /**
     * Task type
     */
    type: string
    /**
     * Task positional arguments
     */
    args: Array<any>
    /**
     * Task keyword arguments
     */
    kwargs: any
    /**
     * Delivery Information about the task Message
     */
    delivery_info: DeliveryInfo
    /**
     * Whether the task message acknowledged
     */
    acknowledged: boolean
    /**
     * When task has started by the worker
     */
    time_start?: number
    /**
     * Worker hostname
     */
    hostname: string
    /**
     * Child worker process ID
     */
    worker_pid?: number
}
