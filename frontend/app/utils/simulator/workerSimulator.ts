import { EventType, Worker, EventCategory } from "@services/server"
import { handleEvent } from "@stores/useStateStore"

const HEARTBEAT_INTERVAL = 2 * 1000 // 2 seconds

const getNewWorker = (name: string, pid: number): Worker => ({
    id: `${name}-${pid}`,
    hostname: name,
    pid: pid,
    software_identity: "Python",
    software_version: "3.11.3",
    software_sys: "Linux",
    active_tasks: 0,
    processed_tasks: 0,
    last_updated: new Date().getTime(),
    cpu_load: [15, 12, 10],
})

const CPU_DEVIATION = 3
const updateCPULoad = (cpuLoad: number[]): number[] => [
    Math.min(Math.max(0, (cpuLoad?.[0] || 0) + Math.random() * CPU_DEVIATION * 2 - CPU_DEVIATION), 100),
    ...cpuLoad.slice(0, 2),
]

export const simulateWorker = (name: string, pid: number) => {
    const worker = getNewWorker(name, pid)

    // Add new worker
    handleEvent({
        type: EventType.WORKER_ONLINE,
        category: EventCategory.WORKER,
        data: worker,
    })

    // Update worker's heartbeat every 2 seconds
    const token = setInterval(() => {
        worker.last_updated = new Date().getTime()
        worker.heartbeat_expires = new Date().getTime() + HEARTBEAT_INTERVAL
        worker.cpu_load = updateCPULoad(worker.cpu_load || [])

        handleEvent({
            type: EventType.WORKER_HEARTBEAT,
            category: EventCategory.WORKER,
            data: worker,
        })
    }, HEARTBEAT_INTERVAL)

    return () => clearInterval(token)
}
