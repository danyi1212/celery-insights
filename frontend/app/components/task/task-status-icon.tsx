import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { cn } from "@lib/utils"
import { TaskState } from "@/types/surreal-records"
import {
    Ban,
    CheckCircle2,
    CircleAlert,
    CircleMinus,
    CirclePlay,
    Clock,
    LucideIcon,
    RotateCw,
    XCircle,
} from "lucide-react"
import React from "react"

interface TaskStatusIconProps extends React.ComponentProps<"span"> {
    status: TaskState
    iconClassName?: string
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

const TaskStatusIcon: React.FC<TaskStatusIconProps> = ({ status, className, iconClassName, ...props }) => {
    const meta = stateMeta[status]
    const Icon = meta.icon
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className={cn("inline-flex", className)} {...props}>
                    <Icon className={cn("size-4", meta.className, iconClassName)} />
                </span>
            </TooltipTrigger>
            <TooltipContent>{meta.tooltip}</TooltipContent>
        </Tooltip>
    )
}

export default TaskStatusIcon
