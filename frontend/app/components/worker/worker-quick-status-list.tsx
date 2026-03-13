import WorkerQuickStatus from "@components/worker/worker-quick-status"
import { useOnlineWorkers } from "@hooks/use-live-workers"
import { extractId } from "@/types/surreal-records"
import React from "react"

const WorkerQuickStatusList: React.FC = () => {
    const { data: workers } = useOnlineWorkers()

    if (workers.length === 0) {
        return <p className="px-2 py-3 text-xs leading-5 text-sidebar-foreground/70">No online workers connected.</p>
    }

    return (
        <div className="flex flex-col gap-1">
            {workers.map((worker) => (
                <WorkerQuickStatus key={extractId(worker.id)} worker={worker} />
            ))}
        </div>
    )
}

export default WorkerQuickStatusList
