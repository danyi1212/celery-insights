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
    [TaskState.RECEIVED]: { icon: Clock, className: "text-blue-500", tooltip: "Received" },
    [TaskState.STARTED]: { icon: CirclePlay, className: "text-blue-500", tooltip: "Started" },
    [TaskState.SUCCESS]: { icon: CheckCircle2, className: "text-green-500", tooltip: "Success" },
    [TaskState.FAILURE]: { icon: CircleAlert, className: "text-red-500", tooltip: "Failure" },
    [TaskState.IGNORED]: { icon: XCircle, className: "text-red-500", tooltip: "Ignored" },
    [TaskState.REJECTED]: { icon: Ban, className: "text-red-500", tooltip: "Rejected" },
    [TaskState.REVOKED]: { icon: CircleMinus, className: "text-yellow-500", tooltip: "Revoked" },
    [TaskState.RETRY]: { icon: RotateCw, className: "text-yellow-500", tooltip: "Retry" },
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
