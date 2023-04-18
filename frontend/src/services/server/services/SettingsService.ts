/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
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

}
