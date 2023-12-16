/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ExchangeInfo } from './ExchangeInfo';

export type QueueInfo = {
    /**
     * Name of the queue
     */
    name?: (string | null);
    /**
     * Exchange information
     */
    exchange?: ExchangeInfo;
    /**
     * Routing key for the queue
     */
    routing_key?: (string | null);
    /**
     * Arguments for the queue
     */
    queue_arguments?: (Record<string, any> | null);
    /**
     * Arguments for bindings
     */
    binding_arguments?: (Record<string, any> | null);
    /**
     * Arguments for consumers
     */
    consumer_arguments?: (Record<string, any> | null);
    /**
     * Queue will survive broker restart
     */
    durable?: boolean;
    /**
     * Queue can be used by only one consumer
     */
    exclusive?: boolean;
    /**
     * Queue will be deleted after last consumer unsubscribes
     */
    auto_delete?: boolean;
    /**
     * Workers will not acknowledge task messages
     */
    no_ack?: boolean;
    /**
     * Queue alias if used for queue names
     */
    alias?: (string | null);
    /**
     * Message TTL in seconds
     */
    message_ttl?: (number | null);
    /**
     * Maximum number of task messages allowed in the queue
     */
    max_length?: (number | null);
    /**
     * Maximum priority for task messages in the queue
     */
    max_priority?: (number | null);
};

