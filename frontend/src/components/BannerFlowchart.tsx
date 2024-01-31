import { getFlowGraph } from "@components/workflow/FlowChart"
import TaskNode from "@components/workflow/TaskNode"
import { useTheme } from "@mui/material"
import useMediaQuery from "@mui/material/useMediaQuery"
import { TaskState } from "@services/server"
import { StateTask } from "@utils/translateServerModels"
import React, { useMemo } from "react"
import ReactFlow, { Background } from "reactflow"

const nodeTypes = {
    taskNode: TaskNode,
}
const createDemoTask = (task: Partial<StateTask>): StateTask => ({
    id: "?",
    type: "Hello, World!",
    state: TaskState.SUCCESS,
    sentAt: new Date(),
    lastUpdated: new Date(),
    children: [],
    ...task,
})
const demoTasks: StateTask[] = [
    createDemoTask({ id: "b0e1bccb-dcf3-4ee6-b30c-7a16105b0d46", type: "submit_order" }),
    createDemoTask({
        id: "3222416c-4967-4f1d-a39c-34cfa8085496",
        type: "create_invoice",
        parentId: "b0e1bccb-dcf3-4ee6-b30c-7a16105b0d46",
        state: TaskState.STARTED,
    }),
    createDemoTask({
        id: "8ec82025-23ff-444c-8f94-ab4e6c0565c9",
        type: "notify_user",
        parentId: "3222416c-4967-4f1d-a39c-34cfa8085496",
        state: TaskState.PENDING,
    }),
    createDemoTask({
        id: "7efdf689-0db9-4a99-b7a0-7ed5b30ab61b",
        type: "update_inventory",
        parentId: "b0e1bccb-dcf3-4ee6-b30c-7a16105b0d46",
    }),
    createDemoTask({
        id: "d1616fea-bca7-4a76-8e44-57180796be28",
        type: "create_shipment",
        parentId: "7efdf689-0db9-4a99-b7a0-7ed5b30ab61b",
    }),
    createDemoTask({
        id: "5c2cd092-db2f-4b75-8e84-794e86a8d116",
        type: "notify_user",
        parentId: "d1616fea-bca7-4a76-8e44-57180796be28",
    }),
    createDemoTask({
        id: "50f9a761-da8a-4f2f-b46d-cb30ca0c2c04",
        type: "generate_sales_report",
        parentId: "d1616fea-bca7-4a76-8e44-57180796be28",
        state: TaskState.FAILURE,
    }),
]
const BannerFlowchart: React.FC = () => {
    const theme = useTheme()
    const isLargeScreen = useMediaQuery(theme.breakpoints.up("xl"))
    const isMediumScreen = useMediaQuery(theme.breakpoints.down("lg"))
    const isSmallScreen = useMediaQuery(theme.breakpoints.down("md")) // Disable graph
    const graph: ReturnType<typeof getFlowGraph> = useMemo(
        () =>
            isSmallScreen
                ? { nodes: [], edges: [] }
                : getFlowGraph(
                      demoTasks,
                      demoTasks[0].id,
                      isLargeScreen ? { x: 5, y: 2.3 } : isMediumScreen ? { x: 3.8, y: 1.3 } : { x: 3.5, y: 2.8 },
                  ),
        [isSmallScreen, isMediumScreen, isLargeScreen],
    )

    return (
        <ReactFlow
            nodes={isSmallScreen ? [] : graph.nodes}
            edges={isSmallScreen ? [] : graph.edges}
            preventScrolling={false}
            zoomOnScroll={false}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
        >
            <Background />
        </ReactFlow>
    )
}
export default BannerFlowchart
