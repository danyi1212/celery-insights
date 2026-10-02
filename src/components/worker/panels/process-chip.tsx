import TaskAvatar from "@components/task/task-avatar"
import { Badge } from "@components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { Clock } from "lucide-react"
import type { TaskRequest } from "@/types/surreal-records"
import React from "react"

interface ProcessChipProps {
  processId: number
  task?: TaskRequest
}

const ProcessChip: React.FC<ProcessChipProps> = ({ processId, task }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="gap-1.5 py-1">
          {task ? (
            <TaskAvatar taskId={task.id} type={task.type} className="size-5" />
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Clock className="size-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="left">Sleeping</TooltipContent>
            </Tooltip>
          )}
          {processId}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>Child Process ID</TooltipContent>
    </Tooltip>
  )
}
export default ProcessChip
