/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ExchangeInfo } from "./ExchangeInfo"

export type QueueInfo = {
    /**
     * Name of the queue
     */
    name: string;
    /**
     * Exchange information
     */
    exchange: ExchangeInfo;
    /**
     * Routing key for the queue
     */
    routing_key: string;
    /**
     * Arguments for the queue
     */
    queue_arguments?: any;
    /**
     * Arguments for bindings
     */
    binding_arguments?: any;
    /**
     * Arguments for consumers
     */
    consumer_arguments?: any;
    /**
     * Queue will survive broker restart
     */
    durable: boolean;
    /**
     * Queue can be used by only one consumer
     */
    exclusive: boolean;
    /**
     * Queue will be deleted after last consumer unsubscribes
     */
    auto_delete: boolean;
    /**
     * Task messages will not be acknowledged by workers
     */
    no_ack: boolean;
    /**
     * Queue alias if used for queue names
     */
    alias?: string;
    /**
     * Message TTL in seconds
     */
    message_ttl?: number;
    /**
     * Maximum number of task messages allowed in the queue
     */
    max_length?: number;
    /**
     * Maximum priority for task messages in the queue
     */
    max_priority?: number;
};

