import Link from "@mui/material/Link"
import { useStateStore } from "@stores/useStateStore"
import React from "react"
import { Link as RouterLink } from "react-router-dom"

function HomePage() {
    const tasks = useStateStore((state) => state.tasks)

    return (
        <ul>
            {tasks.map((taskId, task) => (
                <li key={taskId}>
                    <Link component={RouterLink} to={`tasks/${task.id}`}>
                        {task.id}
                    </Link>{" "}
                    | {task.type} | {task.state}
                </li>
            ))}
        </ul>
    )
}

export default HomePage
