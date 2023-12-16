/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { CPULoad } from './CPULoad';

export type ServerInfo = {
    /**
     * CPU load average in last 1, 5 and 15 minutes
     */
    cpu_usage: CPULoad;
    /**
     * Memory Usage in KB
     */
    memory_usage: number;
    /**
     * Server Uptime in seconds
     */
    uptime: number;
    /**
     * Server Hostname
     */
    server_hostname: string;
    /**
     * Server Port
     */
    server_port: number;
    /**
     * Server Version
     */
    server_version: string;
    /**
     * Server OS
     */
    server_os: string;
    /**
     * Server Device Name
     */
    server_name: string;
    /**
     * Python Version
     */
    python_version: string;
    /**
     * Number of tasks stored in state
     */
    task_count: number;
    /**
     * Maximum number of tasks to store in state
     */
    tasks_max_count: number;
    /**
     * Number of workers running
     */
    worker_count: number;
    /**
     * Maximum number of workers to store in state
     */
    worker_max_count: number;
};

