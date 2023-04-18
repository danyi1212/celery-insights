/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { EventType } from './EventType';
import type { Worker } from './Worker';

export type WorkerEventMessage = {
    type: EventType;
    category: WorkerEventMessage.category;
    worker: Worker;
};

export namespace WorkerEventMessage {

    export enum category {
        WORKER = 'worker',
    }


}

