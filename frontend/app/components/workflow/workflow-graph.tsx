import FlowChart from "@components/workflow/flow-chart"
import TimelineChart from "@components/workflow/timeline-chart"
import { useWorkflowTasks } from "@hooks/use-live-tasks"
import { surrealToStateTask } from "@/types/state-types"
import React, { useDeferredValue, useMemo } from "react"
import { ReactFlowProvider } from "@xyflow/react"
import "@xyflow/react/dist/style.css"

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
    const { data: surrealTasks } = useWorkflowTasks(rootTaskId)
    const workflowTasks = useMemo(() => surrealTasks.map(surrealToStateTask), [surrealTasks])

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
