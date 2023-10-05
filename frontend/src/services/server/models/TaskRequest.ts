/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { DeliveryInfo } from './DeliveryInfo';

export type TaskRequest = {
    /**
     * Task unique id
     */
    id: string;
    /**
     * Task name
     */
    name: string;
    /**
     * Task type
     */
    type: string;
    /**
     * Task positional arguments
     */
    args: Array<any>;
    /**
     * Task keyword arguments
     */
    kwargs: Record<string, any>;
    /**
     * Delivery Information about the task Message
     */
    delivery_info: DeliveryInfo;
    /**
     * Whether the task message is acknowledged
     */
    acknowledged: boolean;
    /**
     * When the task has started by the worker
     */
    time_start?: (number | null);
    /**
     * Worker hostname
     */
    hostname: string;
    /**
     * Child worker process ID
     */
    worker_pid?: (number | null);
};

