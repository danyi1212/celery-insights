import WorkflowTaskNode from "@components/task/WorkflowTaskNode"
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong"
import CropFreeIcon from "@mui/icons-material/CropFree"
import DoNotTouchIcon from "@mui/icons-material/DoNotTouch"
import PanToolIcon from "@mui/icons-material/PanTool"
import Tooltip from "@mui/material/Tooltip"
import { StateTask } from "@utils/translateServerModels"
import React, { useCallback, useEffect, useState } from "react"
import {
    Background,
    ControlButton,
    Controls,
    Edge,
    Node,
    NodeProps,
    ReactFlow,
    useEdgesState,
    useNodesState,
    useReactFlow,
} from "reactflow"

const createNode = (task: StateTask, x: number, y: number, nodeId?: string): Node => ({
    id: nodeId || task.id,
    type: "taskNode",
    position: { x: x * 300, y: y * 100 },
    data: task,
    connectable: false,
    deletable: false,
})

function createEdge(sourceId: string, targetId: string): Edge {
    return {
        id: `${sourceId}>${targetId}`,
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

const FOCUS_ZOOM = 1
const ZOOM_ANIMATION_SPEED = 1000

interface WorkflowFlowChart {
    tasks: StateTask[]
    rootTaskId: string
    currentTaskId?: string
}

const nodeTypes: Record<string, React.ComponentType<NodeProps>> = {
    taskNode: WorkflowTaskNode,
}
export const WorkflowFlowChart: React.FC<WorkflowFlowChart> = ({ tasks, rootTaskId, currentTaskId }) => {
    const flow = useReactFlow()
    const [nodes, setNodes, onNodesChange] = useNodesState([])
    const [edges, setEdges, onEdgesChange] = useEdgesState([])
    const [locked, setLocked] = useState<boolean>(true)

    const focusNode = useCallback(
        (nodeId: string) => {
            const node = nodes.find((node) => node.id === nodeId)
            if (node)
                flow.setCenter(node.position.x, node.position.y, {
                    zoom: FOCUS_ZOOM,
                    duration: ZOOM_ANIMATION_SPEED,
                })
            else flow.setCenter(0, 0, { zoom: FOCUS_ZOOM, duration: ZOOM_ANIMATION_SPEED })
        },
        [flow, nodes]
    )

    const fitView = useCallback(() => flow.fitView({ duration: ZOOM_ANIMATION_SPEED }), [flow])

    useEffect(() => {
        const graph = getGraph(tasks, rootTaskId)
        setNodes(graph.nodes)
        setEdges(graph.edges)
        if (currentTaskId) {
            const node = graph.nodes.find((node) => node.id === currentTaskId)
            if (node)
                flow.setCenter(node.position.x, node.position.y, {
                    zoom: FOCUS_ZOOM,
                    duration: ZOOM_ANIMATION_SPEED,
                })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tasks, rootTaskId, setNodes, setEdges, flow])

    useEffect(() => {
        if (!currentTaskId) fitView()
        else focusNode(currentTaskId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTaskId])

    return (
        <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodesDraggable={locked}
            nodeTypes={nodeTypes}
        >
            <Background />
            <Controls showZoom={false} showFitView={false} showInteractive={false}>
                <ControlButton onClick={() => setLocked((locked) => !locked)}>
                    <Tooltip title={locked ? "Disable interation" : "Enable interation"} placement="right" arrow>
                        {locked ? <DoNotTouchIcon /> : <PanToolIcon />}
                    </Tooltip>
                </ControlButton>
                <ControlButton onClick={() => fitView()}>
                    <Tooltip title="Fit view" placement="right" arrow>
                        <CropFreeIcon />
                    </Tooltip>
                </ControlButton>
                <ControlButton onClick={() => currentTaskId && focusNode(currentTaskId)} disabled={!currentTaskId}>
                    <Tooltip title="Focus current task" placement="right" arrow>
                        <CenterFocusStrongIcon />
                    </Tooltip>
                </ControlButton>
            </Controls>
        </ReactFlow>
    )
}
