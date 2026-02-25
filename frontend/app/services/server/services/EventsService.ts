/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EventMessage } from '../models/EventMessage';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class EventsService {

    constructor(public readonly httpRequest: BaseHttpRequest) {}

    /**
     * Get Events
     * @returns EventMessage Successful Response
     * @throws ApiError
     */
    public getEvents(): CancelablePromise<Array<EventMessage>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/events',
        });
    }

}
