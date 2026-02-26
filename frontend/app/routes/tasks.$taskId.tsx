import { createFileRoute } from "@tanstack/react-router"
import TaskAlerts from "@components/task/alerts/task-alerts"
import ArgumentPanel from "@components/task/cards/argument-panel"
import DeliveryInfoPanel from "@components/task/cards/delivery-info-panel"
import ResultCard from "@components/task/cards/result-card"
import TaskAvatar from "@components/task/task-avatar"
import TaskLifetimeChart from "@components/task/task-lifetime-chart"
import TaskPageHeader from "@components/task/task-page-header"
import WorkflowGraph, { WorkflowChartType } from "@components/workflow/workflow-graph"
import { Skeleton } from "@components/ui/skeleton"
import { useTask } from "@hooks/use-live-tasks"
import { parseTask } from "@/types/surreal-records"
import { useTourChangeStepOnLoad } from "@stores/use-tour-store"
import React, { useMemo } from "react"

const TaskPage = () => {
    const { taskId } = Route.useParams()
    const { task: surrealTask } = useTask(taskId)
    const task = useMemo(() => (surrealTask ? parseTask(surrealTask) : undefined), [surrealTask])
    const [chartType, setChartType] = React.useState<WorkflowChartType>(WorkflowChartType.FLOWCHART)
    useTourChangeStepOnLoad(2, task !== undefined)

    if (task === undefined)
        return (
            <div className="flex h-full flex-col items-center justify-center">
                <div className="flex items-center">
                    <TaskAvatar taskId={taskId} type={undefined} />
                    <h2 className="ml-2 text-2xl font-semibold">Could not find this task</h2>
                </div>
            </div>
        )

    return (
        <div>
            <div className="h-[50vh] w-full" id="workflow-chart">
                {task ? (
                    <WorkflowGraph chartType={chartType} rootTaskId={task.root_id || task.id} currentTaskId={task.id} />
                ) : (
                    <Skeleton className="h-[450px] w-full" />
                )}
            </div>
            <TaskPageHeader task={task} chartType={chartType} setChartType={setChartType} />
            <div className="my-2" id="lifetime-chart">
                {task ? <TaskLifetimeChart task={task} /> : <Skeleton className="h-8 w-full rounded-md" />}
            </div>
            <TaskAlerts taskId={taskId} />
            <div className="grid grid-cols-1 gap-3 px-3 lg:grid-cols-3" id="task-details">
                <DeliveryInfoPanel taskId={taskId} />
                <ArgumentPanel taskId={taskId} />
                <ResultCard taskId={taskId} />
            </div>
        </div>
    )
}

export const Route = createFileRoute("/tasks/$taskId")({
    component: TaskPage,
})
