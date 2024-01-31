/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type Pool = {
    /**
     * Maximum number of child parallelism (processes/threads)
     */
    'max-concurrency'?: number;
    /**
     * Maximum number of tasks to be executed before child recycled
     */
    'max-tasks-per-child'?: number;
    /**
     * Child process IDs (or thread IDs)
     */
    processes?: Array<number>;
    /**
     * Soft time limit and hard time limit, in seconds
     */
    timeouts?: any[];
};

