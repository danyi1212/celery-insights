/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { CPULoad } from './CPULoad';

export type Worker = {
    /**
     * Worker unique name comprised of hostname and pid
     */
    id: string;
    /**
     * Worker hostname
     */
    hostname: string;
    /**
     * Worker OS Process ID
     */
    pid: number;
    /**
     * Name of worker software (e.g, py-celery)
     */
    software_identity: string;
    /**
     * Software version
     */
    software_version: string;
    /**
     * Software Operating System name (e.g, Linux/Darwin)
     */
    software_sys: string;
    /**
     * Number of tasks currently processed by worker
     */
    active_tasks: number;
    /**
     * Number of tasks completed by worker
     */
    processed_tasks: number;
    /**
     * When worker latest event published
     */
    last_updated: number;
    /**
     * When worker will be considered offline
     */
    heartbeat_expires?: (number | null);
    /**
     * Host CPU load average in last 1, 5 and 15 minutes
     */
    cpu_load?: (CPULoad | null);
};

