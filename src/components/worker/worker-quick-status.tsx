import LinearProgressWithLabel from "@components/common/linear-progress-with-label"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import type { SurrealWorker } from "@/types/surreal-records"
import { extractId } from "@/types/surreal-records"
import React from "react"

interface WorkerQuickStatusProps {
  worker: SurrealWorker
}

const WorkerQuickStatus: React.FC<WorkerQuickStatusProps> = ({ worker }) => {
  const hostname = worker.hostname || extractId(worker.id)

  return (
    <div className="rounded-xl px-2 py-2 transition-colors hover:bg-sidebar-accent/40">
      <Tooltip>
        <TooltipTrigger asChild>
          <p className="truncate overflow-hidden text-sm font-medium text-sidebar-foreground">{hostname}</p>
        </TooltipTrigger>
        <TooltipContent>{hostname}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="mt-2">
            <LinearProgressWithLabel value={worker.cpu_load?.[2] || 0} percentageLabel />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">CPU Utilization</TooltipContent>
      </Tooltip>
    </div>
  )
}
export default WorkerQuickStatus
