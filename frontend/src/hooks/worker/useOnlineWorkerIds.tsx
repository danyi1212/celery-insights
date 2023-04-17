import { useStateStore } from "@stores/useStateStore"

const GRACE_SECONDS = 10
export const useOnlineWorkerIds = (): string[] =>
    useStateStore((state) =>
        state.workers
            .map((worker) => worker)
            .filter(
                (worker) =>
                    worker.heartbeatExpires &&
                    worker.heartbeatExpires.getTime() - new Date().getTime() < GRACE_SECONDS * 1000
            )
            .map((worker) => worker.id)
    )
