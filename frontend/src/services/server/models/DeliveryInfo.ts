/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type DeliveryInfo = {
    /**
     * Broker exchange used
     */
    exchange: string;
    /**
     * Message priority
     */
    priority: number;
    /**
     * Message sent back to queue
     */
    redelivered: boolean;
    /**
     * Message routing key used
     */
    routing_key: string;
};

