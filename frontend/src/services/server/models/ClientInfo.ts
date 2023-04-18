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
    os?: string;
    /**
     * Operating System Version
     */
    os_version?: string;
    /**
     * Device Family
     */
    device_family?: string;
    /**
     * Device Brand
     */
    device_brand?: string;
    /**
     * Device Model
     */
    device_model?: string;
    /**
     * Browser Name
     */
    browser?: string;
    /**
     * Browser Version
     */
    browser_version?: string;
};

