import TaskStatusIcon from "@components/task/TaskStatusIcon"
import Link from "@mui/material/Link"
import { useStateStore } from "@stores/useStateStore"
import React, { useCallback } from "react"
import { Link as RouterLink } from "react-router-dom"

interface WorkflowGraphProps {
    rootTaskId: string
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

    return (
        <ul style={{ overflow: "auto", height: "100%" }}>
            {tasks.map((task) => (
                <li key={task.id}>
                    <TaskStatusIcon status={task.state} />
                    <Link component={RouterLink} to={`/tasks/${task.id}`}>
                        {task.id}
                    </Link>{" "}
                    | {task.type}
                </li>
            ))}
        </ul>
    )
}

export default WorkflowGraph
