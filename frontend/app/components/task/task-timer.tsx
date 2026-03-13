import TimeSince from "@components/common/distance-timer"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { cn } from "@lib/utils"
import { useNow } from "@hooks/use-now"
import type { Task } from "@/types/surreal-records"
import { differenceInMinutes, format } from "date-fns"
import { AlarmClock, Clock, LucideIcon } from "lucide-react"
import React, { useMemo } from "react"

interface TaskTimerProps extends React.ComponentProps<"span"> {
    task: Task
}

interface TimerInfo {
    tooltip: string
    icon: LucideIcon
    className: string
    date: Date
}

function getTimerInfo(etaDate: Date | null, expireDate: Date | null, now: Date): TimerInfo | null {
    if (etaDate && etaDate > now) {
        return {
            tooltip: `Starting at ${format(etaDate, "Ppp")}`,
            icon: Clock,
            className: "text-secondary",
            date: etaDate,
        }
    } else if (expireDate) {
        if (expireDate > now) {
            return {
                tooltip: `Expires at ${format(expireDate, "Ppp")}`,
                icon: AlarmClock,
                className: differenceInMinutes(expireDate, now) < 5 ? "text-status-danger" : "text-status-warning",
                date: expireDate,
            }
        } else {
            return {
                tooltip: `Expired at ${format(expireDate, "Ppp")}`,
                icon: AlarmClock,
                className: "text-status-warning",
                date: expireDate,
            }
        }
    } else {
        return null
    }
}

const TaskTimer: React.FC<TaskTimerProps> = ({ task, className, ...props }) => {
    const etaDate = useMemo(() => (task.eta ? new Date(task.eta) : null), [task.eta])
    const expireDate = useMemo(() => (task.expires ? new Date(task.expires) : null), [task.expires])
    const now = useNow(etaDate || expireDate ? 1000 : undefined)
    const info = useMemo(() => getTimerInfo(etaDate, expireDate, now), [etaDate, expireDate, now])

    if (!info) return null

    const Icon = info.icon
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className={cn("inline-flex items-center", info.className, className)} {...props}>
                    <Icon className="mx-1 size-4 align-middle" />
                    <TimeSince time={info.date} addSuffix />
                </span>
            </TooltipTrigger>
            <TooltipContent>{info.tooltip}</TooltipContent>
        </Tooltip>
    )
}

export default TaskTimer
