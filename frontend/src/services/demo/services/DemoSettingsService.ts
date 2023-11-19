import { ClientInfo } from "@services/server/models/ClientInfo"
import { ServerInfo } from "@services/server/models/ServerInfo"
import { WebSocketState } from "@services/server/models/WebSocketState"

export class DemoSettingsService {
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
                user_agent: {
                    os: "Windows",
                    os_version: "10.0",
                    device_family: "Desktop",
                    device_brand: "Apple",
                    device_model: "Mac",
                    browser: "Chrome",
                    browser_version: "90.0.4430.85",
                },
            },
        ])
    }

    clearState(force: boolean = false): Promise<boolean> {
        return force ? Promise.resolve(true) : Promise.reject(false)
    }
}
