import WorkerQuickStatus from "@components/worker/WorkerQuickStatus"
import { Separator } from "@components/ui/separator"
import { useOnlineWorkerIds } from "@hooks/worker/useOnlineWorkerIds"
import React from "react"

const WorkerQuickStatusList: React.FC = () => {
    const workerIds = useOnlineWorkerIds()
    return (
        <div className="flex max-h-[40vh] flex-col gap-1 overflow-auto">
            <h6 className="text-center text-lg font-semibold">Worker Status</h6>
            <Separator />
            {workerIds.map((workerId) => (
                <WorkerQuickStatus key={workerId} workerId={workerId} />
            ))}
        </div>
    )
}

export default WorkerQuickStatusList
