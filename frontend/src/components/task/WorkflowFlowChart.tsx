import { StateTask } from "@utils/translateServerModels"
import React, { useCallback, useEffect } from "react"
import {
    Background,
    Controls,
    Edge,
    Node,
    Position,
    ReactFlow,
    useEdgesState,
    useNodesState,
    useReactFlow,
} from "reactflow"

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

interface WorkflowFlowChart {
    tasks: StateTask[]
    rootTaskId: string
    currentTaskId?: string
}

export const WorkflowFlowChart: React.FC<WorkflowFlowChart> = ({ tasks, rootTaskId, currentTaskId }) => {
    const flow = useReactFlow()
    const [nodes, setNodes, onNodesChange] = useNodesState([])
    const [edges, setEdges, onEdgesChange] = useEdgesState([])

    useEffect(() => {
        const graph = getGraph(tasks, rootTaskId)
        setNodes(graph.nodes)
        setEdges(graph.edges)
    }, [tasks, rootTaskId, setNodes, setEdges])

    const focusNode = useCallback(
        (nodeId: string) => {
            const node = nodes.find((node) => node.id === nodeId)
            if (node) flow.setCenter(node.position.x, node.position.y, { zoom: 0.9 })
            else flow.setCenter(0, 0, { zoom: 0.9 })
        },
        [flow, nodes]
    )

    useEffect(() => {
        if (!currentTaskId) flow.fitView()
        else focusNode(currentTaskId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTaskId])

    return (
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}>
            <Background />
            <Controls />
        </ReactFlow>
    )
}
