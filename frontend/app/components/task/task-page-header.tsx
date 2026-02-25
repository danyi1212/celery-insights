import CopyLinkButton from "@components/common/copy-link-button"
import TaskAvatar from "@components/task/task-avatar"
import TaskTimer from "@components/task/task-timer"
import { Button } from "@components/ui/button"
import { Skeleton } from "@components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { ToggleGroup, ToggleGroupItem } from "@components/ui/toggle-group"
import { WorkflowChartType } from "@components/workflow/workflow-graph"
import { cn } from "@lib/utils"
import { StateTask } from "@utils/translate-server-models"
import { GanttChart, GitBranch } from "lucide-react"
import React, { useState } from "react"
import { useNavigate } from "@tanstack/react-router"

interface TaskPageHeaderProps {
    task: StateTask | undefined
    chartType: WorkflowChartType
    setChartType: (type: WorkflowChartType) => void
}

const TaskPageHeader: React.FC<TaskPageHeaderProps> = ({ task, chartType, setChartType }) => {
    const [isHover, setHover] = useState(false)
    const navigate = useNavigate()
    return (
        <div
            id="task-header"
            className="flex items-center gap-2 border-b bg-card px-4 pt-1 pb-2 shadow-md"
            onPointerEnter={() => setHover(true)}
            onPointerLeave={() => setHover(false)}
        >
            <div className="pr-3">
                {task === undefined ? (
                    <Skeleton className="size-10 rounded-full" />
                ) : (
                    <TaskAvatar taskId={task.id} type={task.type} status={task.state} />
                )}
            </div>
            <div className="flex h-16 flex-col justify-end">
                {task ? <h2 className="text-xl font-semibold">{task.type}</h2> : <Skeleton className="h-6 w-48" />}
                {task ? (
                    <span className="text-xs text-muted-foreground">{task.id}</span>
                ) : (
                    <Skeleton className="h-4 w-64" />
                )}
            </div>
            <div
                className={cn(
                    "transition-opacity duration-200",
                    isHover ? "opacity-100" : "pointer-events-none opacity-0",
                )}
            >
                <CopyLinkButton className="mx-2" />
            </div>
            <div className="flex-grow" />
            <div className="flex flex-row items-center justify-center gap-1">
                {task && <TaskTimer task={task} className="px-1 text-center" />}
                <Button
                    variant="link"
                    className="text-secondary"
                    disabled={!task?.type}
                    onClick={() =>
                        task?.type &&
                        navigate({
                            to: "/explorer",
                            search: { type: task.type },
                        })
                    }
                >
                    Find similar tasks
                </Button>
                <ToggleGroup
                    type="single"
                    value={chartType}
                    onValueChange={(value) => value && setChartType(value as WorkflowChartType)}
                    size="sm"
                    variant="outline"
                    id="workflow-selector"
                >
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <ToggleGroupItem value={WorkflowChartType.FLOWCHART}>
                                <GitBranch className="size-4" />
                            </ToggleGroupItem>
                        </TooltipTrigger>
                        <TooltipContent>Flowchart</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <ToggleGroupItem value={WorkflowChartType.TIMELINE}>
                                <GanttChart className="size-4" />
                            </ToggleGroupItem>
                        </TooltipTrigger>
                        <TooltipContent>Timeline</TooltipContent>
                    </Tooltip>
                </ToggleGroup>
            </div>
        </div>
    )
}
export default TaskPageHeader
