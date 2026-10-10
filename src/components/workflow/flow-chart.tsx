import TaskNode from "@components/workflow/task-node"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useIsDark } from "@hooks/use-is-dark"
import type { Task } from "@/types/surreal-records"
import { Camera, Focus, Maximize2, Move, Navigation } from "lucide-react"
import { toSvg } from "html-to-image"
import React, { useCallback, useEffect, useState } from "react"
import {
  Background,
  ControlButton,
  Controls,
  type Edge,
  getNodesBounds,
  getViewportForBounds,
  MiniMap,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type XYPosition,
} from "@xyflow/react"

const COLUMN_WIDTH = 180
const ROW_HEIGHT = 100

const createNode = (task: Task, x: number, y: number, nodeId?: string): Node => ({
  id: nodeId || task.id,
  type: "taskNode",
  position: { x: x * COLUMN_WIDTH, y: y * ROW_HEIGHT },
  data: task as Task & Record<string, unknown>,
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

const getChildMap = (tasks: Task[]): Map<string, Task[]> => {
  const map = new Map<string, Task[]>()
  for (const task of tasks)
    if (task.parent_id) {
      const id = task.parent_id
      if (!map.has(id)) map.set(id, [])

      map.get(id)?.push(task)
    }
  return map
}

export const getFlowGraph = (
  tasks: Task[],
  rootTaskId: string,
  initialPosition?: XYPosition,
): {
  nodes: Node[]
  edges: Edge[]
} => {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const taskMap = new Map<string, Task>(tasks.map((task) => [task.id, task]))
  const childMap = getChildMap(tasks)
  const visited = new Set<string>()
  // Stored children lists can be stale; only a reachable parent may adopt a parentless child, once.
  const claimed = new Set<string>([rootTaskId])
  let nextLeafRow = 0

  const visitTask = (task: Task, column: number): number => {
    visited.add(task.id)
    const node = createNode(task, column, 0)
    nodes.push(node)

    const children = [...(childMap.get(task.id) || [])]
    for (const childId of task.children) {
      const child = taskMap.get(childId)
      if (!child || child.parent_id || claimed.has(childId)) continue
      claimed.add(childId)
      children.push(child)
    }

    const childRows = children
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((child) => {
        if (visited.has(child.id)) {
          const replacedId = child.id + "-replaced"
          const row = nextLeafRow++
          nodes.push(createNode(child, column + 1, row, replacedId))
          edges.push(createEdge(task.id, replacedId))
          return row
        }
        edges.push(createEdge(task.id, child.id))
        return visitTask(child, column + 1)
      })
    const row = childRows.length ? (childRows[0] + childRows[childRows.length - 1]) / 2 : nextLeafRow++
    node.position.y = row * ROW_HEIGHT
    return row
  }

  const rootTask = taskMap.get(rootTaskId)
  if (rootTask) {
    const rootRow = visitTask(rootTask, initialPosition?.x ?? 0)
    const offset = ((initialPosition?.y ?? 0) - rootRow) * ROW_HEIGHT
    for (const node of nodes) node.position.y += offset
  }

  return {
    nodes: nodes,
    edges: edges,
  }
}

const FOCUS_ZOOM = 1
const ZOOM_ANIMATION_SPEED = 1000

const EXPORT_IMAGE_WIDTH = 1920
const EXPORT_IMAGE_HEIGHT = 1080

function downloadImage(dataUrl: string) {
  const a = document.createElement("a")

  a.setAttribute("download", "celery-insights-export.svg")
  a.setAttribute("href", dataUrl)
  a.click()
}

interface FlowChartProps {
  tasks: Task[]
  rootTaskId: string
  currentTaskId?: string
}

const nodeTypes = {
  taskNode: TaskNode,
}
const FlowChart: React.FC<FlowChartProps> = ({ tasks, rootTaskId, currentTaskId }) => {
  const flow = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[])
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[])
  const [locked, setLocked] = useState<boolean>(true)
  const [isInitialized, setInitialized] = useState<boolean>(false)
  const isDark = useIsDark()

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
    [flow, nodes],
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

  const bgColor = isDark ? "oklch(0.16 0.01 155)" : "oklch(0.95 0.015 150)"
  const hoverColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)"

  const handleDownloadImage = useCallback(() => {
    const nodesBounds = getNodesBounds(nodes)
    const viewport = getViewportForBounds(nodesBounds, EXPORT_IMAGE_WIDTH, EXPORT_IMAGE_HEIGHT, 0.5, 2, 0)
    const element = document.querySelector(".react-flow__viewport") as HTMLElement
    if (!element) return

    toSvg(element, {
      width: EXPORT_IMAGE_WIDTH,
      height: EXPORT_IMAGE_HEIGHT,
      style: {
        backgroundColor: bgColor,
        width: `${EXPORT_IMAGE_WIDTH}px`,
        height: `${EXPORT_IMAGE_HEIGHT}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    }).then(downloadImage)
  }, [nodes, bgColor])

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
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center justify-center">
                {locked ? <Move className="size-3" /> : <Navigation className="size-3" />}
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">{locked ? "Move nodes" : "Move camera"}</TooltipContent>
          </Tooltip>
        </ControlButton>
        <ControlButton onClick={() => fitView()}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center justify-center">
                <Maximize2 className="size-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">Fit view</TooltipContent>
          </Tooltip>
        </ControlButton>
        <ControlButton onClick={() => currentTaskId && focusNode(currentTaskId)} disabled={!currentTaskId}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center justify-center">
                <Focus className="size-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">Focus current task</TooltipContent>
          </Tooltip>
        </ControlButton>
        <ControlButton onClick={() => handleDownloadImage()}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center justify-center">
                <Camera className="size-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">Save as image</TooltipContent>
          </Tooltip>
        </ControlButton>
      </Controls>
      <MiniMap
        position="top-right"
        style={{ backgroundColor: bgColor, height: 100, width: 200 }}
        maskColor={hoverColor}
        pannable
      />
    </ReactFlow>
  )
}

export default FlowChart
