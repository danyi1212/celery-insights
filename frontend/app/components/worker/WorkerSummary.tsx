import LinearProgressWithLabel from "@components/common/LinearProgressWithLabel"
import PanelPaper from "@components/common/PanelPaper"
import TaskAvatar from "@components/task/TaskAvatar"
import { AvatarGroup } from "@components/ui/avatar"
import { Button } from "@components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { TaskState } from "@services/server"
import { useStateStore } from "@stores/useStateStore"
import { StateTask } from "@utils/translateServerModels"
import React, { useCallback, useMemo } from "react"
import { Link } from "@tanstack/react-router"

interface WorkerSummaryProps {
    workerId: string
}

const WorkerSummary: React.FC<WorkerSummaryProps> = ({ workerId }) => {
    const worker = useStateStore((state) => state.workers.get(workerId))
    const tasks = useStateStore(
        useCallback(
            (store) => {
                const related: StateTask[] = []
                store.tasks.forEach((task) => {
                    if (task.worker === workerId) related.push(task)
                })
                return related.sort((a, b) => (a.sentAt > b.sentAt ? -1 : 1))
            },
            [workerId],
        ),
    )
    const startedTasks = useMemo(() => tasks.filter((task) => task.state == TaskState.STARTED), [tasks])
    const receivedTasks = useMemo(() => tasks.filter((task) => task.state == TaskState.RECEIVED), [tasks])

    if (worker === undefined) return <></>

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
                    <Link to={`/workers/${worker.id}`}>View</Link>
                </Button>
            </div>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div>
                        <LinearProgressWithLabel value={worker?.cpuLoad?.[2] || 0} percentageLabel />
                    </div>
                </TooltipTrigger>
                <TooltipContent side="right">CPU Utilization</TooltipContent>
            </Tooltip>
            <p className="text-right text-sm">Received</p>
            <AvatarGroup className="min-h-[44px]">
                {receivedTasks.slice(0, 6).map((task) => (
                    <TaskAvatar key={task.id} taskId={task.id} type={task.type} />
                ))}
            </AvatarGroup>
            <p className="text-right text-sm">Started</p>
            <AvatarGroup className="min-h-[44px]">
                {startedTasks.slice(0, 6).map((task) => (
                    <TaskAvatar key={task.id} taskId={task.id} type={task.type} />
                ))}
            </AvatarGroup>
        </PanelPaper>
    )
}
export default WorkerSummary
