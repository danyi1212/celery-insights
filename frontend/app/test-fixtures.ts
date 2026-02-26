import type { StateTask } from "@/types/state-types"
import { TaskState } from "@/types/surreal-records"

const BASE_TIMESTAMP = 1700000000

export const createStateTask = (overrides: Partial<StateTask> = {}): StateTask => ({
    id: "test-task-id",
    type: "app.tasks.add",
    state: TaskState.SUCCESS,
    sentAt: new Date(BASE_TIMESTAMP * 1000),
    receivedAt: new Date((BASE_TIMESTAMP + 1) * 1000),
    startedAt: new Date((BASE_TIMESTAMP + 2) * 1000),
    succeededAt: new Date((BASE_TIMESTAMP + 5) * 1000),
    runtime: 3.0,
    lastUpdated: new Date((BASE_TIMESTAMP + 5) * 1000),
    args: "('arg1', 'arg2')",
    kwargs: "{'key': 'value'}",
    retries: 0,
    routingKey: "default",
    children: [],
    worker: "worker1@hostname",
    result: "'result_value'",
    ...overrides,
})
