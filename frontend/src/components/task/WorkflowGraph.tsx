import { useStateStore } from "@stores/useStateStore"
import { StateTask } from "@utils/translateServerModels"
import React, { useDeferredValue, useMemo } from "react"
import { Background, Controls, Edge, Node, Position, ReactFlow, ReactFlowInstance } from "reactflow"
import "reactflow/dist/style.css"

const createNode = (task: StateTask, x: number, y: number, nodeId?: string): Node => ({
    id: nodeId || task.id,
    position: { x: x * 300, y: y * 100 },
    data: {
        label: `${task.id} | ${task.type}`,
    },
    connectable: false,
    deletable: false,
    targetPosition: Position.Left,
    sourcePosition: Position.Right,
})

function createEdge(sourceId: string, targetId: string): Edge {
    return {
        id: `${sourceId}-${targetId}`,
        source: sourceId,
        target: targetId,
        type: "straight",
        deletable: false,
    }
}

const getGraph = (tasks: StateTask[], rootTaskId: string): { nodes: Node[]; edges: Edge[] } => {
    const nodes: Node[] = []
    const edges: Edge[] = []
    const taskMap = new Map<string, StateTask>(tasks.map((task) => [task.id, task]))
    const visited = new Set<string>()

    function dfs(task: StateTask, x: number, y: number) {
        visited.add(task.id)
        nodes.push(createNode(task, x, y))

        const children = tasks.filter((child) => child.parentId === task.id)

        if (!children) return

        const startY = y - (children.length - 1) / 2
        const childX = x + 1

        children.forEach((child, index) => {
            const childY = startY + index
            if (visited.has(child.id)) {
                const replacedId = child.id + "-replaced"
                nodes.push(createNode(child, childX, childY, replacedId))
                edges.push(createEdge(task.id, replacedId))
            } else {
                edges.push(createEdge(task.id, child.id))
                dfs(child, childX, childY)
            }
        })
    }

    const rootTask = taskMap.get(rootTaskId)
    if (rootTask) dfs(rootTask, 0, 0)

    return {
        nodes: nodes,
        edges: edges,
    }
}

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
    const graph = useMemo(() => getGraph(deferredTasks, rootTaskId), [deferredTasks, rootTaskId])

    const handleInit = (flow: ReactFlowInstance) => {
        if (!currentTaskId) return flow.fitView()
        const node = graph.nodes.find((node) => node.id === currentTaskId)
        if (node) flow.setCenter(node.position.x, node.position.y, { zoom: 0.9 })
        else flow.setCenter(0, 0, { zoom: 0.9 })
    }

    return (
        <ReactFlow nodes={graph.nodes} edges={graph.edges} onInit={handleInit}>
            <Background />
            <Controls />
        </ReactFlow>
    )
}

export default WorkflowGraph
