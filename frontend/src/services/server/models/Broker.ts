/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type Broker = {
    /**
     * How many seconds before failing to connect to broker
     */
    connection_timeout?: (number | null);
    /**
     * Heartbeat interval in seconds
     */
    heartbeat: number;
    /**
     * Node name of remote broker
     */
    hostname: string;
    /**
     * Login method used to connect to the broker
     */
    login_method: string;
    /**
     * Broker port
     */
    port: number;
    /**
     * Whether to use ssl connections
     */
    ssl: boolean;
    /**
     * Name of transport used (e.g, amqp / redis)
     */
    transport: string;
    /**
     * Additional options used to connect to broker
     */
    transport_options: Record<string, any>;
    /**
     * Prefix to be added to broker uri
     */
    uri_prefix?: (string | null);
    /**
     * User ID used to connect to the broker with
     */
    userid: string;
    /**
     * Virtual host used
     */
    virtual_host: string;
};

