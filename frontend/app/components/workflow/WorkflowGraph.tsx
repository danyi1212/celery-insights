import FlowChart from "@components/workflow/FlowChart"
import TimelineChart from "@components/workflow/TimelineChart"
import { useStateStore } from "@stores/useStateStore"
import { StateTask } from "@utils/translateServerModels"
import React, { useDeferredValue } from "react"
import { ReactFlowProvider } from "reactflow"
import "reactflow/dist/style.css"
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
            return <TimelineChart tasks={deferredTasks} rootTaskId={rootTaskId} currentTaskId={currentTaskId} />
    }
}

export default WorkflowGraph
