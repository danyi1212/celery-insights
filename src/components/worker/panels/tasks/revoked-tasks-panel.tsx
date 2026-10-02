import AnimatedList from "@components/common/animated-list"
import AnimatedListItem from "@components/common/animated-list-item"
import Panel, { PanelProps } from "@components/common/panel"
import TaskAvatar from "@components/task/task-avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useWorkerRevokedTasks } from "@hooks/worker/use-worker-inspect"
import { useTask } from "@hooks/use-live-tasks"
import { TaskState } from "@/types/surreal-records"
import { ChevronRight } from "lucide-react"
import React from "react"
import { Link } from "@tanstack/react-router"

interface RevokedTasksPanelProps {
  workerId: string
}

interface RevokedTaskListItemProps extends Omit<PanelProps, "title"> {
  taskId: string
}

const RevokedTaskListItem: React.FC<RevokedTaskListItemProps> = ({ taskId }) => {
  const { task } = useTask(taskId)
  return (
    <AnimatedListItem disablePadding>
      <Link
        to={`/tasks/${taskId}` as string}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-accent"
      >
        <TaskAvatar taskId={taskId} type={task?.type} status={task?.state as TaskState | undefined} disableLink />
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

const RevokedTasksPanel: React.FC<RevokedTasksPanelProps> = ({ workerId, ...props }) => {
  const { tasks, isLoading, error } = useWorkerRevokedTasks(workerId)
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
