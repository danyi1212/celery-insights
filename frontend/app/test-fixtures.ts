import type { Task } from "@/types/surreal-records"
import { TaskState } from "@/types/surreal-records"

const BASE_TIMESTAMP = 1700000000

export const createTask = (overrides: Partial<Task> = {}): Task => ({
    id: "test-task-id",
    type: "app.tasks.add",
    state: TaskState.SUCCESS,
    sent_at: new Date(BASE_TIMESTAMP * 1000),
    received_at: new Date((BASE_TIMESTAMP + 1) * 1000),
    started_at: new Date((BASE_TIMESTAMP + 2) * 1000),
    succeeded_at: new Date((BASE_TIMESTAMP + 5) * 1000),
    runtime: 3.0,
    last_updated: new Date((BASE_TIMESTAMP + 5) * 1000),
    args: "('arg1', 'arg2')",
    kwargs: "{'key': 'value'}",
    retries: 0,
    routing_key: "default",
    children: [],
    worker: "worker1@hostname",
    result: "'result_value'",
    ...overrides,
})
