/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { TaskRequest } from './TaskRequest';

export type ScheduledTask = {
    /**
     * Absolute time when the task should be executed
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

