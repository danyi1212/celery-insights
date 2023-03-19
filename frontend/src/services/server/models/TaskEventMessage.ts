/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type {EventType} from "./EventType"
import type {Task} from "./Task"

export type TaskEventMessage = {
    type: EventType
    category: TaskEventMessage.category
    task: Task
}

export namespace TaskEventMessage {
    export enum category {
        TASK = "task",
    }
}
