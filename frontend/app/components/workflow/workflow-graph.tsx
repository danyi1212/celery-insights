import FlowChart from "@components/workflow/flow-chart"
import TimelineChart from "@components/workflow/timeline-chart"
import { useStateStore } from "@stores/use-state-store"
import { StateTask } from "@utils/translate-server-models"
import React, { useDeferredValue } from "react"
import { ReactFlowProvider } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { shallow } from "zustand/shallow"

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
    const workflowTasks = useStateStore((state) => {
        const workflow: StateTask[] = []
        state.tasks.forEach((task) => {
            if (task.rootId === rootTaskId || task.id === rootTaskId) workflow.push(task)
        })
        return workflow
    }, shallow)

    const deferredTasks = useDeferredValue(workflowTasks)
    switch (chartType) {
        case WorkflowChartType.FLOWCHART:
            return (
                <ReactFlowProvider>
                    <FlowChart tasks={deferredTasks} rootTaskId={rootTaskId} currentTaskId={currentTaskId} />
                </ReactFlowProvider>
            )
        case WorkflowChartType.TIMELINE:
            return <TimelineChart tasks={deferredTasks} currentTaskId={currentTaskId} />
    }
}

export default WorkflowGraph
