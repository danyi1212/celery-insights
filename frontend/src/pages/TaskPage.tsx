import useTaskResult from "@hooks/useTaskResult"
import useTaskState from "@hooks/useTaskState"
import Typography from "@mui/material/Typography"
import React from "react"
import { useParams } from "react-router-dom"

const TaskPage: React.FC = () => {
    const { taskId } = useParams() as { taskId: string }
    const { task } = useTaskState(taskId)
    const { taskResult } = useTaskResult(taskId)
    return <Typography component="pre">{JSON.stringify(task, null, 2)}</Typography>
}

export default TaskPage
