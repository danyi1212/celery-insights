import WorkerQuickStatus from "@components/worker/worker-quick-status"
import { Separator } from "@components/ui/separator"
import { useOnlineWorkers } from "@hooks/use-live-workers"
import { extractId } from "@utils/translate-server-models"
import React from "react"

const WorkerQuickStatusList: React.FC = () => {
    const { data: workers } = useOnlineWorkers()
    return (
        <div className="flex max-h-[40vh] flex-col gap-1 overflow-auto">
            <h6 className="text-center text-lg font-semibold">Worker Status</h6>
            <Separator />
            {workers.map((worker) => (
                <WorkerQuickStatus key={extractId(worker.id)} worker={worker} />
            ))}
        </div>
    )
}

export default WorkerQuickStatusList
