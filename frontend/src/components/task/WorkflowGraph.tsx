import FlowChart from "@components/task/workflow/FlowChart"
import TimelineChart from "@components/task/workflow/TimelineChart"
import { useStateStore } from "@stores/useStateStore"
import React, { useDeferredValue, useMemo } from "react"
import { ReactFlowProvider } from "reactflow"
import "reactflow/dist/style.css"

export enum WorkflowChartType {
    FLOWCHART = "flowchart",
    TIMELINE = "timeline",
}

interface WorkflowGraphProps {
    rootTaskId: string
    currentTaskId?: string
    chartType: WorkflowChartType
}

const WorkflowGraph: React.FC<WorkflowGraphProps> = ({ chartType, rootTaskId, currentTaskId }) => {
    const tasks = useStateStore((state) => state.tasks)
    const workflowTasks = useMemo(
        () => tasks.map((task) => task).filter((task) => task.rootId === rootTaskId || task.id === rootTaskId),
        [tasks, rootTaskId]
    )

    const deferredTasks = useDeferredValue(workflowTasks)
    switch (chartType) {
        case WorkflowChartType.FLOWCHART:
            return (
                <ReactFlowProvider>
                    <FlowChart tasks={deferredTasks} rootTaskId={rootTaskId} currentTaskId={currentTaskId} />
                </ReactFlowProvider>
            )
        case WorkflowChartType.TIMELINE:
            return <TimelineChart tasks={deferredTasks} rootTaskId={rootTaskId} currentTaskId={currentTaskId} />
    }
}

export default WorkflowGraph
