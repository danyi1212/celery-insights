import AnimatedListItem from "@components/common/animated-list-item"
import TaskAvatar from "@components/task/task-avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { CheckCircle, ChevronRight, XCircle } from "lucide-react"
import type { TaskRequest } from "@/types/surreal-records"
import React from "react"
import { Link } from "@tanstack/react-router"

interface TaskListItemProps {
    task: TaskRequest
    subtitle?: string | React.ReactNode
}

const TaskListItem: React.FC<TaskListItemProps> = ({ task, subtitle }) => {
    return (
        <AnimatedListItem disablePadding>
            <Link
                to={`/tasks/${task.id}`}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-accent"
            >
                <TaskAvatar taskId={task.id} type={task.type} disableLink />
                <div className="min-w-0 flex-grow">
                    <p className="truncate text-sm font-medium">{task.type}</p>
                    <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    {task.acknowledged ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <CheckCircle className="size-4 text-green-500" />
                            </TooltipTrigger>
                            <TooltipContent>Message Acknowledged</TooltipContent>
                        </Tooltip>
                    ) : (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <XCircle className="size-4 text-amber-500" />
                            </TooltipTrigger>
                            <TooltipContent>Message Not Acknowledged</TooltipContent>
                        </Tooltip>
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <ChevronRight className="size-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>View task...</TooltipContent>
                    </Tooltip>
                </div>
            </Link>
        </AnimatedListItem>
    )
}
export default TaskListItem
