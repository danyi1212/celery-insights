/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { UserAgentInfo } from './UserAgentInfo';
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
     * User agent details
     */
    user_agent?: (UserAgentInfo | null);
};

