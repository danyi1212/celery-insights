import TaskNode from "@components/workflow/TaskNode"
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong"
import ControlCameraIcon from "@mui/icons-material/ControlCamera"
import CropFreeIcon from "@mui/icons-material/CropFree"
import PanToolIcon from "@mui/icons-material/PanTool"
import { useTheme } from "@mui/material"
import Tooltip from "@mui/material/Tooltip"
import { StateTask } from "@utils/translateServerModels"
import React, { useCallback, useEffect, useState } from "react"
import {
    Background,
    ControlButton,
    Controls,
    Edge,
    MiniMap,
    Node,
    NodeProps,
    ReactFlow,
    useEdgesState,
    useNodesState,
    useReactFlow,
    XYPosition,
} from "reactflow"

const createNode = (task: StateTask, x: number, y: number, nodeId?: string): Node => ({
    id: nodeId || task.id,
    type: "taskNode",
    position: { x: x * 180, y: y * 100 },
    data: task,
    connectable: false,
    deletable: false,
})

function createEdge(sourceId: string, targetId: string): Edge {
    return {
        id: `${sourceId}>${targetId}`,
        source: sourceId,
        target: targetId,
        type: "simplebezier",
        deletable: false,
    }
}

const getChildMap = (tasks: StateTask[]): Map<string, StateTask[]> => {
    const map = new Map<string, StateTask[]>()
    for (const task of tasks)
        if (task.parentId) {
            const id = task.parentId
            if (!map.has(id)) map.set(id, [])

            map.get(id)?.push(task)
        }
    return map
}

export const getFlowGraph = (
    tasks: StateTask[],
    rootTaskId: string,
    initialPosition?: XYPosition
): {
    nodes: Node[]
    edges: Edge[]
} => {
    const nodes: Node[] = []
    const edges: Edge[] = []
    const taskMap = new Map<string, StateTask>(tasks.map((task) => [task.id, task]))
    const childMap = getChildMap(tasks)
    const visited = new Set<string>()

    function dfs(task: StateTask, x: number, y: number) {
        visited.add(task.id)
        nodes.push(createNode(task, x, y))

        const children = childMap.get(task.id) || []

        if (!children) return

        const startY = y - (children.length - 1) / 2
        const childX = x + 1

        children
            .sort((a, b) => (a.id.localeCompare(b.id)))
            .forEach((child, index) => {
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
    if (rootTask) dfs(rootTask, initialPosition?.x || 0, initialPosition?.y || 0)

    return {
        nodes: nodes,
        edges: edges,
    }
}

const FOCUS_ZOOM = 1
const ZOOM_ANIMATION_SPEED = 1000

interface FlowChartProps {
    tasks: StateTask[]
    rootTaskId: string
    currentTaskId?: string
}

const nodeTypes: Record<string, React.ComponentType<NodeProps>> = {
    taskNode: TaskNode,
}
const FlowChart: React.FC<FlowChartProps> = ({ tasks, rootTaskId, currentTaskId }) => {
    const flow = useReactFlow()
    const [nodes, setNodes, onNodesChange] = useNodesState([])
    const [edges, setEdges, onEdgesChange] = useEdgesState([])
    const [locked, setLocked] = useState<boolean>(true)
    const [isInitialized, setInitialized] = useState<boolean>(false)
    const theme = useTheme()

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
        const graph = getFlowGraph(tasks, rootTaskId)
        setNodes(graph.nodes)
        setEdges(graph.edges)
        if (!isInitialized && currentTaskId) {
            const node = graph.nodes.find((node) => node.id === currentTaskId)
            if (node)
                flow.setCenter(node.position.x, node.position.y, {
                    zoom: FOCUS_ZOOM,
                    duration: ZOOM_ANIMATION_SPEED,
                })
        }
        setInitialized(true)
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
            nodesDraggable={!locked}
            nodeTypes={nodeTypes}
        >
            <Background />
            <Controls showZoom={false} showFitView={false} showInteractive={false}>
                <ControlButton onClick={() => setLocked((locked) => !locked)}>
                    <Tooltip title={locked ? "Move nodes" : "Move camera"} placement="right" arrow>
                        {locked ? <PanToolIcon /> : <ControlCameraIcon />}
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
            <MiniMap
                position="top-right"
                style={{ backgroundColor: theme.palette.background.default, height: 100, width: 200 }}
                maskColor={theme.palette.action.hover}
                pannable
            />
        </ReactFlow>
    )
}

export default FlowChart
