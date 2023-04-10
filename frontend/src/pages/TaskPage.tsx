import ExceptionAlert from "@components/task/alerts/ExceptionAlert"
import RetryAlert from "@components/task/alerts/RetryAlert"
import ArgumentsCard from "@components/task/cards/ArgumentsCard"
import { DeliveryInfoCard } from "@components/task/cards/DeliveryInfoCard"
import ResultCard from "@components/task/cards/ResultCard"
import TaskLifetimeChart from "@components/task/TaskLifetimeChart"
import TaskPageHeader from "@components/task/TaskPageHeader"
import WorkflowGraph, { WorkflowChartType } from "@components/workflow/WorkflowGraph"
import useTaskResult from "@hooks/useTaskResult"
import useTaskState from "@hooks/useTaskState"
import Box from "@mui/material/Box"
import CircularProgress from "@mui/material/CircularProgress"
import Grid from "@mui/material/Grid"
import Stack from "@mui/material/Stack"
import Typography from "@mui/material/Typography"
import React from "react"
import { useParams } from "react-router-dom"

const TaskPage: React.FC = () => {
    const { taskId } = useParams() as { taskId: string }
    const { task, loading } = useTaskState(taskId)
    const { taskResult, isLoading, error } = useTaskResult(taskId)

    const [chartType, setChartType] = React.useState<WorkflowChartType>(WorkflowChartType.FLOWCHART)

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
        <Box>
            <Box width="100%" height="450px">
                <WorkflowGraph chartType={chartType} rootTaskId={task.rootId || task.id} currentTaskId={task.id} />
            </Box>
            <TaskPageHeader task={task} chartType={chartType} setChartType={setChartType} />
            <TaskLifetimeChart task={task} />
            <Stack spacing={2} m={3}>
                <RetryAlert retries={task.retries || taskResult?.retries} />
                <ExceptionAlert exception={task.exception} traceback={task.traceback || taskResult?.traceback} />
            </Stack>
            <Grid container spacing={3} px={3}>
                <Grid item lg={4} xs={12}>
                    <DeliveryInfoCard task={task} />
                </Grid>
                <Grid item lg={4} xs={12}>
                    <ArgumentsCard task={task} result={taskResult} loading={isLoading} error={error} />
                </Grid>
                <Grid item lg={4} xs={12}>
                    <ResultCard result={taskResult} loading={isLoading} error={error} />
                </Grid>
            </Grid>
        </Box>
    )
}

export default TaskPage
