import LinearProgressWithLabel from "@components/common/linear-progress-with-label"
import PanelPaper from "@components/common/panel-paper"
import TaskAvatar from "@components/task/task-avatar"
import { AvatarGroup } from "@components/ui/avatar"
import { Button } from "@components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { TaskState } from "@/types/surreal-records"
import { useWorker } from "@hooks/use-live-workers"
import { useWorkerTasks } from "@hooks/use-live-tasks"
import { extractId } from "@/types/surreal-records"
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

    if (worker === null) return <></>

    const workerDisplayId = extractId(worker.id)

    return (
        <PanelPaper className="px-2">
            <div className="flex items-center">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <h4 className="flex-grow truncate text-lg font-semibold">{worker.hostname}</h4>
                    </TooltipTrigger>
                    <TooltipContent>{worker.hostname}</TooltipContent>
                </Tooltip>
                <Button variant="outline" asChild>
                    <Link to={`/workers/${workerDisplayId}`}>View</Link>
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
            <p className="text-right text-sm">Received</p>
            <AvatarGroup className="min-h-[44px]">
                {receivedTasks.slice(0, 6).map((task) => {
                    const taskId = extractId(task.id)
                    return <TaskAvatar key={taskId} taskId={taskId} type={task.type} />
                })}
            </AvatarGroup>
            <p className="text-right text-sm">Started</p>
            <AvatarGroup className="min-h-[44px]">
                {startedTasks.slice(0, 6).map((task) => {
                    const taskId = extractId(task.id)
                    return <TaskAvatar key={taskId} taskId={taskId} type={task.type} />
                })}
            </AvatarGroup>
        </PanelPaper>
    )
}
export default WorkerSummary
