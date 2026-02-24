import LinearProgressWithLabel from "@components/common/LinearProgressWithLabel"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useStateStore } from "@stores/useStateStore"
import React from "react"

interface WorkerQuickStatusProps {
    workerId: string
}

const WorkerQuickStatus: React.FC<WorkerQuickStatusProps> = ({ workerId }) => {
    const worker = useStateStore((state) => state.workers.get(workerId))
    if (worker === undefined) return <></>
    return (
        <div className="m-1">
            <Tooltip>
                <TooltipTrigger asChild>
                    <p className="mx-1 truncate overflow-hidden text-sm font-medium">{worker.hostname}</p>
                </TooltipTrigger>
                <TooltipContent>{worker.hostname}</TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div>
                        <LinearProgressWithLabel
                            value={worker.cpuLoad?.[2] || 0}
                            buffer={worker.cpuLoad?.[0] || 0}
                            percentageLabel
                        />
                    </div>
                </TooltipTrigger>
                <TooltipContent side="right">CPU Utilization</TooltipContent>
            </Tooltip>
        </div>
    )
}
export default WorkerQuickStatus
