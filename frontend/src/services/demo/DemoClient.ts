/* eslint-disable @typescript-eslint/no-unused-vars */
import { ClientInfo } from "@services/server"
import { Paginated_Task_ } from "@services/server/models/Paginated_Task_"
import { QueueInfo } from "@services/server/models/QueueInfo"
import { ScheduledTask } from "@services/server/models/ScheduledTask"
import { ServerInfo } from "@services/server/models/ServerInfo"
import { Stats } from "@services/server/models/Stats"
import { Task } from "@services/server/models/Task"
import { TaskRequest } from "@services/server/models/TaskRequest"
import { TaskResult } from "@services/server/models/TaskResult"
import { TaskState } from "@services/server/models/TaskState"
import { WebSocketState } from "@services/server/models/WebSocketState"

class DemoTasksService {
    getTasks(limit = 1000, offset?: number): Promise<Paginated_Task_> {
        return Promise.resolve({
            count: 0,
            results: [],
        })
    }

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

class DemoEventsService {}

class DemoSettingsService {
    getServerInfo(): Promise<ServerInfo> {
        return Promise.resolve({
            server_hostname: "localhost",
            server_port: 8555,
            server_version: "v0.0.0",
            cpu_usage: [15, 20, 25],
            memory_usage: 5000,
            uptime: 0,
            server_os: "Linux",
            server_name: "Demo Server",
            python_version: "3.11.3",
            task_count: 0,
            tasks_max_count: 10000,
            worker_count: 3,
            worker_max_count: 5000,
        })
    }

    getClients(): Promise<Array<ClientInfo>> {
        return Promise.resolve([
            {
                host: "localhost",
                port: 8080,
                state: WebSocketState._1,
                is_secure: true,
                os: "Windows",
                os_version: "10.0",
                device_family: "Desktop",
                device_brand: "Apple",
                device_model: "Mac",
                browser: "Chrome",
                browser_version: "90.0.4430.85",
            },
        ])
    }
}

class DemoWorkersService {
    getWorkers(alive?: boolean): Promise<Array<Worker>> {
        return Promise.resolve([])
    }

    getWorkerStats(timeout = 10, worker?: string): Promise<Record<string, Stats>> {
        return Promise.resolve({})
    }

    getWorkerRegistered(timeout = 10, worker?: string): Promise<Record<string, Array<string>>> {
        return Promise.resolve({})
    }

    getWorkerRevoked(timeout = 10, worker?: string): Promise<Record<string, Array<string>>> {
        return Promise.resolve({})
    }

    getWorkerScheduled(timeout = 10, worker?: string): Promise<Record<string, Array<ScheduledTask>>> {
        return Promise.resolve({})
    }

    getWorkerReserved(timeout = 10, worker?: string): Promise<Record<string, Array<TaskRequest>>> {
        return Promise.resolve({})
    }

    getWorkerActive(timeout = 10, worker?: string): Promise<Record<string, Array<TaskRequest>>> {
        return Promise.resolve({})
    }

    getWorkerQueues(timeout = 10, worker?: string): Promise<Record<string, Array<QueueInfo>>> {
        return Promise.resolve({})
    }
}

export default class DemoClient {
    tasks: DemoTasksService
    events: DemoEventsService
    settings: DemoSettingsService
    workers: DemoWorkersService

    constructor() {
        this.tasks = new DemoTasksService()
        this.events = new DemoEventsService()
        this.settings = new DemoSettingsService()
        this.workers = new DemoWorkersService()
    }
}
