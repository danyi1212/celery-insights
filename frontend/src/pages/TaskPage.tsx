import ExceptionAlert from "@components/task/alerts/ExceptionAlert"
import RetryAlert from "@components/task/alerts/RetryAlert"
import ArgumentsCard from "@components/task/cards/ArgumentsCard"
import { DeliveryInfoCard } from "@components/task/cards/DeliveryInfoCard"
import ResultCard from "@components/task/cards/ResultCard"
import TaskAvatar from "@components/task/TaskAvatar"
import TaskLifetimeChart from "@components/task/TaskLifetimeChart"
import TaskPageHeader from "@components/task/TaskPageHeader"
import WorkflowGraph, { WorkflowChartType } from "@components/workflow/WorkflowGraph"
import useTaskResult from "@hooks/task/useTaskResult"
import useTaskState from "@hooks/task/useTaskState"
import Box from "@mui/material/Box"
import CircularProgress from "@mui/material/CircularProgress"
import Collapse from "@mui/material/Collapse"
import Grid from "@mui/material/Grid"
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
            <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                <CircularProgress size="100px" />
            </Box>
        )

    if (task === undefined)
        return (
            <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" height="100%">
                <Box sx={{ display: "flex", alignItems: "center" }}>
                    <TaskAvatar taskId={taskId} type={undefined} />
                    <Typography variant="h4" color="textPrimary" ml={2}>
                        Could not find this task
                    </Typography>
                </Box>
            </Box>
        )

    return (
        <Box>
            <Box width="100%" height="450px">
                <WorkflowGraph chartType={chartType} rootTaskId={task.rootId || task.id} currentTaskId={task.id} />
            </Box>
            <TaskPageHeader task={task} chartType={chartType} setChartType={setChartType} />
            <Box my={2}>
                <TaskLifetimeChart task={task} />
            </Box>
            <Collapse in={Boolean(task.retries || taskResult?.retries)} unmountOnExit>
                <RetryAlert retries={task.retries || taskResult?.retries} sx={{ m: 3 }} />
            </Collapse>
            <Collapse in={Boolean(task.exception)} unmountOnExit>
                <ExceptionAlert
                    exception={task.exception || ""}
                    traceback={task.traceback || taskResult?.traceback}
                    currentTaskId={task.id}
                    sx={{ m: 3 }}
                />
            </Collapse>
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
