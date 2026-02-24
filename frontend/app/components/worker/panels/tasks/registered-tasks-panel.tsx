import Panel, { PanelProps } from "@components/common/panel"
import { Avatar, AvatarFallback } from "@components/ui/avatar"
import { Badge } from "@components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import useWorkerRegisteredTasks from "@hooks/worker/use-worker-registered-tasks"
import useWorkerStats from "@hooks/worker/use-worker-stats"
import { ChevronRight } from "lucide-react"
import React, { useMemo } from "react"
import { useNavigate } from "@tanstack/react-router"
import stc from "string-to-color"
import { getBrightness } from "@utils/color-utils"

interface RegisteredTasksPanelProps extends Omit<PanelProps, "title"> {
    workerId: string
    hostname: string
}

const acronymize = (str: string): string => {
    const words = str.split(/\W+/)
    const firstLetter = words[0].charAt(0).toUpperCase()
    const lastLetter = words[words.length - 1].charAt(0).toUpperCase()
    return firstLetter + lastLetter
}

interface TaskTypeListItemProps {
    taskType: string
    workerId: string
    count?: number
}

const TaskTypeListItem: React.FC<TaskTypeListItemProps> = ({ taskType, workerId, count }) => {
    const backgroundColor = useMemo(() => stc(taskType), [taskType])
    const textColor = useMemo(() => (getBrightness(backgroundColor) > 50 ? "#000" : "#fff"), [backgroundColor])
    const acronym = useMemo(() => acronymize(taskType), [taskType])
    const navigate = useNavigate()
    return (
        <li>
            <button
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-accent"
                onClick={() =>
                    navigate({
                        to: "/explorer",
                        search: { type: taskType, worker: workerId },
                    })
                }
            >
                <div className="relative">
                    <Avatar>
                        <AvatarFallback style={{ backgroundColor, color: textColor }}>{acronym}</AvatarFallback>
                    </Avatar>
                    {count != null && count > 0 && (
                        <Badge className="absolute -right-2 -bottom-1 h-4 min-w-4 px-1 text-[10px]">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span>{count}</span>
                                </TooltipTrigger>
                                <TooltipContent>Count of this task type processed by worker</TooltipContent>
                            </Tooltip>
                        </Badge>
                    )}
                </div>
                <span className="flex-grow truncate text-left text-sm">{taskType}</span>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>View task...</TooltipContent>
                </Tooltip>
            </button>
        </li>
    )
}

const RegisteredTasksPanel: React.FC<RegisteredTasksPanelProps> = ({ workerId, hostname, ...props }) => {
    const { tasks, isLoading, error } = useWorkerRegisteredTasks(hostname)
    const { stats } = useWorkerStats(hostname)
    return (
        <Panel title="Registered Task Types" loading={isLoading} error={error} {...props}>
            {tasks && tasks.length > 0 ? (
                <ul>
                    {tasks.map((taskType) => (
                        <TaskTypeListItem
                            key={taskType}
                            taskType={taskType}
                            workerId={workerId}
                            count={stats?.total?.[taskType]}
                        />
                    ))}
                </ul>
            ) : (
                <div className="flex items-center justify-center p-3">
                    <h4 className="text-center text-2xl font-semibold">No registered tasks found</h4>
                </div>
            )}
        </Panel>
    )
}

export default RegisteredTasksPanel
