import { useStateStore } from "@stores/useStateStore"
import { StateTask } from "@utils/translateServerModels"
import React, { useCallback, useDeferredValue, useMemo } from "react"
import { Background, Controls, Edge, Node, ReactFlow } from "reactflow"
import "reactflow/dist/style.css"

interface WorkflowGraphProps {
    rootTaskId: string
}

const getGraph = (tasks: StateTask[]): { nodes: Node[]; edges: Edge[] } => {
    const nodes: Node[] = tasks.map((task, index) => ({
        id: task.id,
        position: { x: index * 100, y: index * 100 },
        data: {
            label: `${task.id} | ${task.type}`,
        },
    }))
    const edges: Edge[] = tasks
        .filter((task) => task.parentId !== undefined)
        .map((task) => ({
            id: `${task.parentId} > ${task.parentId}`,
            source: task.parentId as string,
            target: task.id,
        }))
    return {
        nodes: nodes,
        edges: edges,
    }
}

const WorkflowGraph: React.FC<WorkflowGraphProps> = ({ rootTaskId }) => {
    const tasks = useStateStore(
        useCallback(
            (state) =>
                state.tasks
                    .map((_, task) => task)
                    .filter((task) => task.rootId === rootTaskId || task.id === rootTaskId),
            [rootTaskId]
        )
    )

    const deferredTasks = useDeferredValue(tasks)
    const graph = useMemo(() => getGraph(deferredTasks), [deferredTasks])

    return (
        <ReactFlow nodes={graph.nodes} edges={graph.edges}>
            <Background />
            <Controls />
        </ReactFlow>
    )
}

export default WorkflowGraph
