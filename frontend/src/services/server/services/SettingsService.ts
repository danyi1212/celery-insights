/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ClientDebugInfo } from '../models/ClientDebugInfo';
import type { ClientInfo } from '../models/ClientInfo';
import type { ServerInfo } from '../models/ServerInfo';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class SettingsService {

    constructor(public readonly httpRequest: BaseHttpRequest) {}

    /**
     * Get Server Info
     * @returns ServerInfo Successful Response
     * @throws ApiError
     */
    public getServerInfo(): CancelablePromise<ServerInfo> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/settings/info',
        });
    }

    /**
     * Get Clients
     * @returns ClientInfo Successful Response
     * @throws ApiError
     */
    public getClients(): CancelablePromise<Array<ClientInfo>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/settings/clients',
        });
    }

    /**
     * Clear State
     * @param force
     * @returns boolean Successful Response
     * @throws ApiError
     */
    public clearState(
        force: boolean = false,
    ): CancelablePromise<boolean> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/settings/clear',
            query: {
                'force': force,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

    /**
     * Download Debug Bundle
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public downloadDebugBundle(
        requestBody: ClientDebugInfo,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/settings/download-debug-bundle',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }

}
