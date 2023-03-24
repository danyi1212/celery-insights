import FlowChart from "@components/task/workflow/FlowChart"
import { useStateStore } from "@stores/useStateStore"
import React, { useDeferredValue, useMemo } from "react"
import { ReactFlowProvider } from "reactflow"
import "reactflow/dist/style.css"

interface WorkflowGraphProps {
    rootTaskId: string
    currentTaskId?: string
}

const WorkflowGraph: React.FC<WorkflowGraphProps> = ({ rootTaskId, currentTaskId }) => {
    const tasks = useStateStore((state) => state.tasks)
    const workflowTasks = useMemo(
        () => tasks.map((task) => task).filter((task) => task.rootId === rootTaskId || task.id === rootTaskId),
        [tasks, rootTaskId]
    )

    const deferredTasks = useDeferredValue(workflowTasks)
    return (
        <ReactFlowProvider>
            <FlowChart tasks={deferredTasks} rootTaskId={rootTaskId} currentTaskId={currentTaskId} />
        </ReactFlowProvider>
    )
}

export default WorkflowGraph
