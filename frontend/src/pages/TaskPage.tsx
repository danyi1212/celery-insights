import Typography from "@mui/material/Typography"
import { useStateStore } from "@stores/useStateStore"
import React from "react"
import { useParams } from "react-router-dom"

const TaskPage: React.FC = () => {
    const { taskId } = useParams()
    const task = useStateStore((state) =>
        taskId ? state.tasks.get(taskId) : undefined
    )
    return (
        <Typography component="pre">{JSON.stringify(task, null, 2)}</Typography>
    )
}

export default TaskPage
