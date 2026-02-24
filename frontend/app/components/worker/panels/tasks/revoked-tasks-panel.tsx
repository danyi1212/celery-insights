import AnimatedList from "@components/common/animated-list"
import AnimatedListItem from "@components/common/animated-list-item"
import Panel, { PanelProps } from "@components/common/panel"
import TaskAvatar from "@components/task/task-avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import useWorkerRevokedTasks from "@hooks/worker/use-worker-revoked-tasks"
import { ChevronRight } from "lucide-react"
import { useStateStore } from "@stores/use-state-store"
import React, { useCallback } from "react"
import { Link } from "@tanstack/react-router"

interface RevokedTasksPanelProps {
    hostname: string
}

interface RevokedTaskListItemProps extends Omit<PanelProps, "title"> {
    taskId: string
}

const RevokedTaskListItem: React.FC<RevokedTaskListItemProps> = ({ taskId }) => {
    const task = useStateStore(useCallback((state) => state.tasks.get(taskId), [taskId]))
    return (
        <AnimatedListItem disablePadding>
            <Link
                to={`/tasks/${taskId}`}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-accent"
            >
                <TaskAvatar taskId={taskId} type={task?.type} status={task?.state} disableLink />
                <div className="min-w-0 flex-grow">
                    <p className="truncate text-sm font-medium">{task?.type || "Unknown task"}</p>
                    <p className="truncate text-xs text-muted-foreground">{taskId}</p>
                </div>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>View task...</TooltipContent>
                </Tooltip>
            </Link>
        </AnimatedListItem>
    )
}

const RevokedTasksPanel: React.FC<RevokedTasksPanelProps> = ({ hostname, ...props }) => {
    const { tasks, isLoading, error } = useWorkerRevokedTasks(hostname)
    return (
        <Panel title="Revoked Tasks" loading={isLoading} error={error} {...props}>
            {tasks && tasks.length > 0 ? (
                <AnimatedList>
                    {tasks.map((taskId) => (
                        <RevokedTaskListItem key={taskId} taskId={taskId} />
                    ))}
                </AnimatedList>
            ) : (
                <div className="flex items-center justify-center p-3">
                    <h4 className="text-center text-2xl font-semibold">Revoke list is empty</h4>
                </div>
            )}
        </Panel>
    )
}

export default RevokedTasksPanel
