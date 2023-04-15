import { useStateStore } from "@stores/useStateStore"
import { StateWorker } from "@utils/translateServerModels"

export const useOnlineWorkers = (): StateWorker[] =>
    useStateStore((state) =>
        state.workers
            .map((worker) => worker)
            .filter((worker) => worker.heartbeatExpires && worker.heartbeatExpires > new Date())
    )
