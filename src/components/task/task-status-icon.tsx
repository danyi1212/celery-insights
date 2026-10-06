import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { cn } from "@lib/utils"
import { TaskState } from "@/types/surreal-records"
import { useNow } from "@hooks/use-now"
import { getTaskExecution, TASK_EXECUTION_LABELS, type TaskExecutionObservation } from "@utils/task-execution"
import {
  Ban,
  CheckCircle2,
  CircleAlert,
  CircleMinus,
  CirclePlay,
  CircleHelp,
  Clock,
  LucideIcon,
  RotateCw,
  XCircle,
} from "lucide-react"
import React from "react"

interface TaskStatusIconProps extends React.ComponentProps<"span"> {
  status: TaskState
  iconClassName?: string
  /** Omit for aggregate states such as workflow rollups; the icon then shows the plain state. */
  execution?: TaskExecutionObservation
}

interface StateIconMeta {
  icon: LucideIcon
  className: string
  tooltip: string
}

const stateMeta: Record<TaskState, StateIconMeta> = {
  [TaskState.PENDING]: { icon: Clock, className: "text-muted-foreground", tooltip: "Pending" },
  [TaskState.RECEIVED]: { icon: Clock, className: "text-status-info", tooltip: "Received" },
  [TaskState.STARTED]: { icon: CirclePlay, className: "text-status-info", tooltip: "Started" },
  [TaskState.SUCCESS]: { icon: CheckCircle2, className: "text-status-success", tooltip: "Success" },
  [TaskState.FAILURE]: { icon: CircleAlert, className: "text-status-danger", tooltip: "Failure" },
  [TaskState.IGNORED]: { icon: XCircle, className: "text-status-danger", tooltip: "Ignored" },
  [TaskState.REJECTED]: { icon: Ban, className: "text-status-danger", tooltip: "Rejected" },
  [TaskState.REVOKED]: { icon: CircleMinus, className: "text-status-warning", tooltip: "Revoked" },
  [TaskState.RETRY]: { icon: RotateCw, className: "text-status-warning", tooltip: "Retry" },
}

const TaskStatusIcon: React.FC<TaskStatusIconProps> = ({ status, execution, className, iconClassName, ...props }) => {
  const annotated = status === TaskState.STARTED && execution !== undefined
  const now = useNow(annotated ? 10_000 : undefined)
  const observed = getTaskExecution(execution ?? {}, now.getTime())
  const meta = annotated
    ? {
        icon: observed === "active" ? CirclePlay : CircleHelp,
        className: observed === "active" ? "text-status-info" : "text-status-warning",
        tooltip: `Started; ${TASK_EXECUTION_LABELS[observed]}`,
      }
    : stateMeta[status]
  const Icon = meta.icon
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex", className)} aria-label={meta.tooltip} {...props}>
          <Icon className={cn("size-4", meta.className, iconClassName)} />
        </span>
      </TooltipTrigger>
      <TooltipContent>{meta.tooltip}</TooltipContent>
    </Tooltip>
  )
}

export default TaskStatusIcon
