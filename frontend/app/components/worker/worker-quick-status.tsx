import LinearProgressWithLabel from "@components/common/linear-progress-with-label"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import type { SurrealWorker } from "@/types/surreal-records"
import { extractId } from "@utils/translate-server-models"
import React from "react"

interface WorkerQuickStatusProps {
    worker: SurrealWorker
}

const WorkerQuickStatus: React.FC<WorkerQuickStatusProps> = ({ worker }) => {
    const hostname = worker.hostname || extractId(worker.id)
    return (
        <div className="m-1">
            <Tooltip>
                <TooltipTrigger asChild>
                    <p className="mx-1 truncate overflow-hidden text-sm font-medium">{hostname}</p>
                </TooltipTrigger>
                <TooltipContent>{hostname}</TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div>
                        <LinearProgressWithLabel value={worker.cpu_load?.[2] || 0} percentageLabel />
                    </div>
                </TooltipTrigger>
                <TooltipContent side="right">CPU Utilization</TooltipContent>
            </Tooltip>
        </div>
    )
}
export default WorkerQuickStatus
