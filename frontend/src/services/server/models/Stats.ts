/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Broker } from './Broker';
import type { Pool } from './Pool';

export type Stats = {
    /**
     * Current broker stats
     */
    broker: Broker;
    /**
     * Current logical clock time
     */
    clock: number;
    /**
     * Uptime in seconds
     */
    uptime: number;
    /**
     * Process ID of worker instance (Main process)
     */
    pid: number;
    /**
     * Current pool stats
     */
    pool: Pool;
    /**
     * Current prefetch task queue for consumer
     */
    prefetch_count: number;
    /**
     * Operating System statistics
     */
    rusage: Record<string, any>;
    /**
     * Count of accepted tasks by type
     */
    total: Record<string, number>;
};

