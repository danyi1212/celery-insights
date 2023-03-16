/* istanbul ignore file */
import type {BaseHttpRequest} from "../core/BaseHttpRequest"

import type {CancelablePromise} from "../core/CancelablePromise"
/* tslint:disable */
/* eslint-disable */
import type {Paginated_Task_} from "../models/Paginated_Task_"
import type {Task} from "../models/Task"
import type {TaskResult} from "../models/TaskResult"

export class TasksService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}

    /**
     * Get Tasks
     * @param limit
     * @param offset
     * @returns Paginated_Task_ Successful Response
     * @throws ApiError
     */
    public getTasks(
        limit: number = 1000,
        offset?: number
    ): CancelablePromise<Paginated_Task_> {
        return this.httpRequest.request({
            method: "GET",
            url: "/api/tasks",
            query: {
                limit: limit,
                offset: offset,
            },
            errors: {
                422: `Validation Error`,
            },
        })
    }

    /**
     * Get Task Detail
     * @param taskId
     * @returns Task Successful Response
     * @throws ApiError
     */
    public getTaskDetail(taskId: string): CancelablePromise<Task> {
        return this.httpRequest.request({
            method: "GET",
            url: "/api/tasks/{task_id}",
            path: {
                task_id: taskId,
            },
            errors: {
                404: `Task not found.`,
                422: `Validation Error`,
            },
        })
    }

    /**
     * Get Task Result
     * @param taskId
     * @returns TaskResult Successful Response
     * @throws ApiError
     */
    public getTaskResult(taskId: string): CancelablePromise<TaskResult> {
        return this.httpRequest.request({
            method: "GET",
            url: "/api/tasks/{task_id}/result",
            path: {
                task_id: taskId,
            },
            errors: {
                404: `Task not found.`,
                422: `Validation Error`,
            },
        })
    }
}
