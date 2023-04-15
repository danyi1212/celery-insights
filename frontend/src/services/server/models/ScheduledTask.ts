/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { TaskRequest } from "./TaskRequest"

export type ScheduledTask = {
    /**
     * Absolute time when task should be executed
     */
    eta: string;
    /**
     * Message priority
     */
    priority: number;
    /**
     * Task Information
     */
    request: TaskRequest;
};

