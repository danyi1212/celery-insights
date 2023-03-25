import TaskStatusIcon from "@components/task/TaskStatusIcon"
import Link from "@mui/material/Link"
import { useStateStore } from "@stores/useStateStore"
import React, { useMemo } from "react"
import { Link as RouterLink } from "react-router-dom"

function HomePage() {
    const tasks = useStateStore((state) => state.tasks)
    const sortedTasks = useMemo(() => tasks.map((t) => t).sort((a, b) => (a.sentAt > b.sentAt ? -1 : 1)), [tasks])

    return (
        <ul>
            {sortedTasks.map((task) => (
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

export default HomePage
