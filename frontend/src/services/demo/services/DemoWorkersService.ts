import { QueueInfo } from "@services/server/models/QueueInfo"
import { ScheduledTask } from "@services/server/models/ScheduledTask"
import { Stats } from "@services/server/models/Stats"
import { TaskRequest } from "@services/server/models/TaskRequest"
import { TaskState } from "@services/server/models/TaskState"
import { useStateStore } from "@stores/useStateStore"

const fakePIDs = [
    12345, 67890, 23456, 78901, 34567, 89012, 45678, 90123, 56789, 12390, 23401, 34512, 45623, 56734, 67845, 78956,
]

const getStringHash = (input: string): number => {
    let sum = 0
    for (let i = 0; i < input.length; i++) {
        sum += input.charCodeAt(i)
    }
    return sum % 17
}

export class DemoWorkersService {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getWorkers(alive?: boolean): Promise<Array<Worker>> {
        return Promise.resolve([])
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getWorkerStats(timeout = 10, worker?: string): Promise<Record<string, Stats>> {
        if (worker) {
            const totals: Record<string, number> = {}
            useStateStore.getState().tasks.forEach((task) => {
                if (task.worker?.split("-", 1)[0] === worker && task.type)
                    totals[task.type] = (totals?.[task.type] || 0) + 1
            })
            return Promise.resolve({
                [worker]: {
                    clock: new Date().getTime() / 1000,
                    uptime: 0,
                    pid: 123,
                    prefetch_count: 1,
                    broker: {
                        hostname: "127.0.0.1",
                        heartbeat: 120,
                        ssl: true,
                        port: 5672,
                        transport: "amqp",
                        transport_options: {},
                        login_method: "PLAIN",
                        userid: "guest",
                        virtual_host: "/",
                    },
                    pool: {
                        "max-concurrency": 16,
                        "max-tasks-per-child": 0,
                        processes: fakePIDs,
                        timeouts: [1740, 1800],
                        "put-guarded-by-semaphore": false,
                        writes: {
                            total: 9,
                            avg: "1.00",
                            all: "1.00",
                            raw: "9",
                            strategy: "fair",
                            inqueues: {
                                total: 1,
                                active: 0,
                            },
                        },
                    },
                    rusage: {},
                    total: totals,
                },
            })
        } else return Promise.resolve({})
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getWorkerRegistered(timeout = 10, worker?: string): Promise<Record<string, Array<string>>> {
        if (worker) {
            const tasks: Set<string> = new Set()
            useStateStore.getState().tasks.forEach((task) => {
                if (task.type) tasks.add(task.type)
            })
            return Promise.resolve({
                [worker]: Array.from(tasks),
            })
        } else return Promise.resolve({})
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getWorkerRevoked(timeout = 10, worker?: string): Promise<Record<string, Array<string>>> {
        if (worker) {
            const tasks: string[] = []
            useStateStore.getState().tasks.forEach((task) => {
                if (task.state === TaskState.REVOKED) tasks.push(task.id)
            })
            return Promise.resolve({
                [worker]: tasks,
            })
        } else return Promise.resolve({})
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getWorkerScheduled(timeout = 10, worker?: string): Promise<Record<string, Array<ScheduledTask>>> {
        if (worker) {
            const tasks: ScheduledTask[] = []
            useStateStore.getState().tasks.forEach((task) => {
                if (task.state === TaskState.RECEIVED && task.eta && task.worker?.split("-", 1)[0] === worker)
                    tasks.push({
                        eta: task.eta,
                        priority: 0,
                        request: {
                            id: task.id,
                            name: task.type || "Unknown",
                            type: task.type || "Unknown",
                            args: [],
                            kwargs: {},
                            delivery_info: {
                                exchange: "default",
                                redelivered: Boolean(task.retries),
                                routing_key: "default",
                            },
                            acknowledged: false,
                            time_start: task.startedAt && task.startedAt?.getTime() / 1000,
                            hostname: worker,
                        },
                    })
            })
            return Promise.resolve({
                [worker]: tasks,
            })
        } else return Promise.resolve({})
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getWorkerReserved(timeout = 10, worker?: string): Promise<Record<string, Array<TaskRequest>>> {
        if (worker) {
            const tasks: TaskRequest[] = []
            useStateStore.getState().tasks.forEach((task) => {
                if (task.state === TaskState.RECEIVED && task.worker?.split("-", 1)[0] === worker)
                    tasks.push({
                        id: task.id,
                        name: task.type || "Unknown",
                        type: task.type || "Unknown",
                        args: [],
                        kwargs: {},
                        delivery_info: {
                            exchange: "default",
                            redelivered: Boolean(task.retries),
                            routing_key: "default",
                        },
                        acknowledged: false,
                        time_start: task.startedAt && task.startedAt?.getTime() / 1000,
                        hostname: worker,
                    })
            })
            return Promise.resolve({
                [worker]: tasks,
            })
        } else return Promise.resolve({})
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getWorkerActive(timeout = 10, worker?: string): Promise<Record<string, Array<TaskRequest>>> {
        if (worker) {
            const tasks: TaskRequest[] = []
            useStateStore.getState().tasks.forEach((task) => {
                if (task.state === TaskState.STARTED && task.worker?.split("-", 1)[0] === worker)
                    tasks.push({
                        id: task.id,
                        name: task.type || "Unknown",
                        type: task.type || "Unknown",
                        args: [],
                        kwargs: {},
                        delivery_info: {
                            exchange: "default",
                            redelivered: Boolean(task.retries),
                            routing_key: "default",
                        },
                        acknowledged: true,
                        time_start: task.startedAt && task.startedAt?.getTime() / 1000,
                        hostname: worker,
                        worker_pid: fakePIDs[getStringHash(task.id)],
                    })
            })
            return Promise.resolve({
                [worker]: tasks,
            })
        } else return Promise.resolve({})
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getWorkerQueues(timeout = 10, worker?: string): Promise<Record<string, Array<QueueInfo>>> {
        if (worker)
            return Promise.resolve({
                [worker]: [
                    {
                        name: "default",
                        routing_key: "default",
                        exchange: {
                            name: "default",
                            type: "direct",
                        },
                        durable: true,
                        exclusive: false,
                        auto_delete: false,
                        no_ack: false,
                    },
                ],
            })
        else return Promise.resolve({})
    }
}
