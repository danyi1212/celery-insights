import type { Task, Worker, EventMessage } from "@services/server"
import { EventCategory, EventType, TaskState } from "@services/server"
import type { StateTask } from "@utils/translate-server-models"

const BASE_TIMESTAMP = 1700000000

export const createServerTask = (overrides: Partial<Task> = {}): Task => ({
    id: "test-task-id",
    type: "app.tasks.add",
    state: TaskState.SUCCESS,
    sent_at: BASE_TIMESTAMP,
    received_at: BASE_TIMESTAMP + 1,
    started_at: BASE_TIMESTAMP + 2,
    succeeded_at: BASE_TIMESTAMP + 5,
    failed_at: null,
    retried_at: null,
    revoked_at: null,
    rejected_at: null,
    runtime: 3.0,
    last_updated: BASE_TIMESTAMP + 5,
    args: "('arg1', 'arg2')",
    kwargs: "{'key': 'value'}",
    eta: null,
    expires: null,
    retries: 0,
    exchange: null,
    routing_key: "default",
    root_id: null,
    parent_id: null,
    children: [],
    worker: "worker1@hostname",
    result: "'result_value'",
    exception: null,
    traceback: null,
    ...overrides,
})

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

export const createServerWorker = (overrides: Partial<Worker> = {}): Worker => ({
    id: "worker1@hostname",
    hostname: "hostname",
    pid: 12345,
    software_identity: "py-celery",
    software_version: "5.4.0",
    software_sys: "Linux",
    active_tasks: 2,
    processed_tasks: 100,
    last_updated: BASE_TIMESTAMP,
    heartbeat_expires: BASE_TIMESTAMP + 120,
    cpu_load: [0.5, 1.0, 1.5],
    ...overrides,
})

export const createTaskEventMessage = (taskOverrides: Partial<Task> = {}): EventMessage => ({
    type: EventType.TASK_SENT,
    category: EventCategory.TASK,
    data: createServerTask(taskOverrides),
})

export const createWorkerEventMessage = (workerOverrides: Partial<Worker> = {}): EventMessage => ({
    type: EventType.WORKER_ONLINE,
    category: EventCategory.WORKER,
    data: createServerWorker(workerOverrides),
})
