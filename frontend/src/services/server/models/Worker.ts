/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type Worker = {
    /**
     * Worker unique name comprised of hostname and pid
     */
    id: string
    /**
     * Worker hostname
     */
    hostname: string
    /**
     * Worker OS Process ID
     */
    pid: number
    /**
     * Name of worker software (e.g, py-celery)
     */
    software_identity: string
    /**
     * Software version
     */
    software_version: string
    /**
     * Software Operating System name (e.g, Linux/Darwin)
     */
    software_sys: string
    /**
     * Amount of tasks currently processing by worker
     */
    active_tasks: number
    /**
     * Amount of tasks completed by worker
     */
    processed_tasks: number
    /**
     * When worker last event published
     */
    last_updated: string
    /**
     * When worker will be considered offline
     */
    heartbeat_expires?: string
    /**
     * Host CPU load average in last 1, 5 and 15 minutes
     */
    cpu_load?: Array<any>
}

