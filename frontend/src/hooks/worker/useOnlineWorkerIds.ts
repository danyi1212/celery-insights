import { useStateStore } from "@stores/useStateStore"

const GRACE_SECONDS = 10
export const useOnlineWorkerIds = (): string[] =>
    useStateStore((state) => {
        const workers: string[] = []
        state.workers.forEach((worker) => {
            if (
                worker.heartbeatExpires &&
                worker.heartbeatExpires.getTime() - new Date().getTime() < GRACE_SECONDS * 1000
            ) {
                workers.push(worker.id)
            }
        })
        return workers.sort((a, b) => a.localeCompare(b))
    })
