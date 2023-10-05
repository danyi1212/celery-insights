import { Paginated_Task_ } from "@services/server"
import { Task } from "@services/server/models/Task"
import { TaskResult } from "@services/server/models/TaskResult"
import { TaskState } from "@services/server/models/TaskState"

export class DemoTasksService {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getTasks(limit = 1000, offset?: number): Promise<Paginated_Task_> {
        return Promise.resolve({
            count: 0,
            next: null,
            previous: null,
            results: [],
        })
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getTaskDetail(taskId: string): Promise<Task> {
        return Promise.reject("Not found")
    }

    getTaskResult(taskId: string): Promise<TaskResult> {
        return Promise.resolve({
            id: taskId,
            state: TaskState.PENDING,
            ignored: false,
            args: [],
            kwargs: {},
            result: null,
            retries: 0,
        })
    }
}
