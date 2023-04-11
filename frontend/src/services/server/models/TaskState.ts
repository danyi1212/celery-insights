/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

/**
 * An enumeration.
 */
export enum TaskState {
    PENDING = "PENDING",
    RECEIVED = "RECEIVED",
    STARTED = "STARTED",
    SUCCESS = "SUCCESS",
    FAILURE = "FAILURE",
    REVOKED = "REVOKED",
    REJECTED = "REJECTED",
    RETRY = "RETRY",
    IGNORED = "IGNORED",
}
