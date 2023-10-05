/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { EventCategory } from './EventCategory';
import type { EventType } from './EventType';
import type { Task } from './Task';
import type { Worker } from './Worker';

export type EventMessage = {
    type: EventType;
    category: EventCategory;
    data: (Task | Worker);
};

