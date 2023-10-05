/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { WebSocketState } from './WebSocketState';

export type ClientInfo = {
    /**
     * Client Hostname
     */
    host: string;
    /**
     * Client Port
     */
    port: number;
    /**
     * Connection State
     */
    state: WebSocketState;
    /**
     * Connection Secure Scheme WSS
     */
    is_secure: boolean;
    /**
     * Operating System Name
     */
    os?: (string | null);
    /**
     * Operating System Version
     */
    os_version?: (string | null);
    /**
     * Device Family
     */
    device_family?: (string | null);
    /**
     * Device Brand
     */
    device_brand?: (string | null);
    /**
     * Device Model
     */
    device_model?: (string | null);
    /**
     * Browser Name
     */
    browser?: (string | null);
    /**
     * Browser Version
     */
    browser_version?: (string | null);
};

