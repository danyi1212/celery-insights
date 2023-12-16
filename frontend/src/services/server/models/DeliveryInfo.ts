/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type DeliveryInfo = {
    /**
     * Broker exchange used
     */
    exchange?: (string | null);
    /**
     * Message priority
     */
    priority?: (number | null);
    /**
     * Message sent back to queue
     */
    redelivered?: boolean;
    /**
     * Message routing key used
     */
    routing_key?: (string | null);
};

