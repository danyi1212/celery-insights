import { useStateStore } from "@stores/useStateStore"
import { StateTask } from "@utils/translateServerModels"
import React, { useDeferredValue, useMemo } from "react"
import { Background, Controls, Edge, Node, Position, ReactFlow } from "reactflow"
import "reactflow/dist/style.css"

interface WorkflowGraphProps {
    rootTaskId: string
}

const createNode = (task: StateTask, x: number, y: number): Node => ({
    id: task.id,
    position: { x: x * 500, y: y * 100 },
    data: {
        label: `${task.id} | ${task.type}`,
    },
    connectable: false,
    deletable: false,
    targetPosition: Position.Left,
    sourcePosition: Position.Right,
})

function createEdge(source: StateTask, target: StateTask): Edge {
    return {
        id: `${source.id}-${target.id}`,
        source: source.id,
        target: target.id,
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
                console.log("Possible loop between task", task.id, "and task", child.id)
            } else {
                edges.push(createEdge(task, child))
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

const WorkflowGraph: React.FC<WorkflowGraphProps> = ({ rootTaskId }) => {
    const tasks = useStateStore((state) => state.tasks)
    const workflowTasks = useMemo(
        () => tasks.map((_, task) => task).filter((task) => task.rootId === rootTaskId || task.id === rootTaskId),
        [tasks, rootTaskId]
    )

    const deferredTasks = useDeferredValue(workflowTasks)
    const graph = useMemo(() => getGraph(deferredTasks, rootTaskId), [deferredTasks, rootTaskId])

    return (
        <ReactFlow nodes={graph.nodes} edges={graph.edges}>
            <Background />
            <Controls />
        </ReactFlow>
    )
}

export default WorkflowGraph
