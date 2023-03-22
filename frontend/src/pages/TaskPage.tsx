import TaskStatusIcon from "@components/task/TaskStatusIcon"
import useTaskResult from "@hooks/useTaskResult"
import useTaskState from "@hooks/useTaskState"
import Box from "@mui/material/Box"
import CircularProgress from "@mui/material/CircularProgress"
import Container from "@mui/material/Container"
import Toolbar from "@mui/material/Toolbar"
import Typography from "@mui/material/Typography"
import React from "react"
import { useParams } from "react-router-dom"

const TaskPage: React.FC = () => {
    const { taskId } = useParams() as { taskId: string }
    const { task, loading } = useTaskState(taskId)
    const { taskResult } = useTaskResult(taskId)

    if (loading)
        return (
            <Box display="flex" height="50%" alignItems="center" justifyContent="center">
                <CircularProgress size="100px" />
            </Box>
        )

    if (task === undefined)
        return (
            <Typography variant="h3" align="center" m={5}>
                Task {taskId} is not found.
            </Typography>
        )

    return (
        <Container maxWidth="lg">
            <Box width="100%" height="450px" bgcolor="grey"></Box>
            <Toolbar>
                <TaskStatusIcon status={task.state} />
                <Typography variant="h6" mx={2} noWrap>
                    {task.id} | {task.type}
                </Typography>
            </Toolbar>
            <Typography component="pre">{JSON.stringify(task, null, 2)}</Typography>
            <Typography component="pre">{JSON.stringify(taskResult, null, 2)}</Typography>
        </Container>
    )
}

export default TaskPage
