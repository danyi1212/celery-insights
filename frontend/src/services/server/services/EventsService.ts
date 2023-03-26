/* istanbul ignore file */
import type {BaseHttpRequest} from "../core/BaseHttpRequest"

import type {CancelablePromise} from "../core/CancelablePromise"
/* tslint:disable */
/* eslint-disable */
import type {TaskEventMessage} from "../models/TaskEventMessage"
import type {WorkerEventMessage} from "../models/WorkerEventMessage"

export class EventsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}

    /**
     * Get Events
     * @returns any Successful Response
     * @throws ApiError
     */
    public getEvents(): CancelablePromise<Array<TaskEventMessage | WorkerEventMessage>> {
        return this.httpRequest.request({
            method: "GET",
            url: "/api/events",
        })
    }
}
