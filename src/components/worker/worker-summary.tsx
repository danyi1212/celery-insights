import LinearProgressWithLabel from "@components/common/linear-progress-with-label"
import PanelPaper from "@components/common/panel-paper"
import TaskAvatar from "@components/task/task-avatar"
import { Badge } from "@components/ui/badge"
import { AvatarGroup, AvatarGroupCount } from "@components/ui/avatar"
import { Button } from "@components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { cn } from "@lib/utils"
import { TaskState } from "@/types/surreal-records"
import { useWorker } from "@hooks/use-live-workers"
import { useWorkerTasks } from "@hooks/use-live-tasks"
import { extractId } from "@/types/surreal-records"
import { Clock3, Play } from "lucide-react"
import React, { useMemo } from "react"
import { Link } from "@tanstack/react-router"

interface WorkerSummaryProps {
  workerId: string
}

const WorkerSummary: React.FC<WorkerSummaryProps> = ({ workerId }) => {
  const { worker } = useWorker(workerId)
  const { data: tasks } = useWorkerTasks(workerId)
  const startedTasks = useMemo(() => tasks.filter((task) => task.state === TaskState.STARTED), [tasks])
  const receivedTasks = useMemo(() => tasks.filter((task) => task.state === TaskState.RECEIVED), [tasks])
  const taskStrip = useMemo(
    () => [
      ...receivedTasks.map((task) => ({ task, tone: "muted" as const })),
      ...startedTasks.map((task) => ({ task, tone: "live" as const })),
    ],
    [receivedTasks, startedTasks],
  )

  if (worker === null) return <></>

  const workerDisplayId = extractId(worker.id)
  const visibleTasks = taskStrip.slice(0, 8)
  const overflowCount = taskStrip.length - visibleTasks.length

  return (
    <PanelPaper className="border border-border/60 bg-background/70 px-2.5 py-2.5">
      <div className="mb-2 flex items-start gap-2.5">
        <div className="min-w-0 flex-grow">
          <Tooltip>
            <TooltipTrigger asChild>
              <h4 className="truncate text-base font-semibold">{worker.hostname}</h4>
            </TooltipTrigger>
            <TooltipContent>{worker.hostname}</TooltipContent>
          </Tooltip>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge variant="outline" className="px-2 py-0 text-[11px]">
              {receivedTasks.length} received
            </Badge>
            <Badge variant="outline" className="px-2 py-0 text-[11px]">
              {startedTasks.length} started
            </Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/workers/${workerDisplayId}` as string}>View</Link>
        </Button>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <LinearProgressWithLabel value={worker.cpu_load?.[2] || 0} percentageLabel />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">CPU Utilization</TooltipContent>
      </Tooltip>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="size-3.5" />
          Received first
        </span>
        <span className="inline-flex items-center gap-1">
          <Play className="size-3.5 text-status-info" />
          Started live
        </span>
      </div>
      <AvatarGroup className="mt-2 min-h-8 items-center">
        {visibleTasks.map(({ task, tone }) => {
          const taskId = extractId(task.id)
          return (
            <TaskAvatar
              key={taskId}
              taskId={taskId}
              type={task.type}
              status={task.state as TaskState}
              className={cn("size-7", tone === "muted" && "opacity-45 saturate-50")}
            />
          )
        })}
        {overflowCount > 0 && <AvatarGroupCount>+{overflowCount}</AvatarGroupCount>}
      </AvatarGroup>
    </PanelPaper>
  )
}
export default WorkerSummary
