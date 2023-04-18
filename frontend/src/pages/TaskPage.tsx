import TaskAlerts from "@components/task/alerts/TaskAlerts"
import ArgumentPanel from "@components/task/cards/ArgumentPanel"
import DeliveryInfoPanel from "@components/task/cards/DeliveryInfoPanel"
import ResultCard from "@components/task/cards/ResultCard"
import TaskAvatar from "@components/task/TaskAvatar"
import TaskLifetimeChart from "@components/task/TaskLifetimeChart"
import TaskPageHeader from "@components/task/TaskPageHeader"
import WorkflowGraph, { WorkflowChartType } from "@components/workflow/WorkflowGraph"
import useTaskState from "@hooks/task/useTaskState"
import Box from "@mui/material/Box"
import Grid from "@mui/material/Grid"
import Skeleton from "@mui/material/Skeleton"
import Typography from "@mui/material/Typography"
import React from "react"
import { useParams } from "react-router-dom"

const TaskPage: React.FC = () => {
    const { taskId } = useParams() as { taskId: string }
    const { task, loading } = useTaskState(taskId)
    const [chartType, setChartType] = React.useState<WorkflowChartType>(WorkflowChartType.FLOWCHART)

    if (!loading && task === undefined)
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
            <Box width="100%" height="450px" id="worflow-chart">
                {task ? (
                    <WorkflowGraph chartType={chartType} rootTaskId={task.rootId || task.id} currentTaskId={task.id} />
                ) : (
                    <Skeleton variant="rectangular" width="100%" height="450px" />
                )}
            </Box>
            <TaskPageHeader task={task} chartType={chartType} setChartType={setChartType} />
            <Box my={2}>
                {task ? <TaskLifetimeChart task={task} /> : <Skeleton variant="rounded" animation="wave" />}
            </Box>
            <TaskAlerts taskId={taskId} />
            <Grid container spacing={3} px={3}>
                <Grid item lg={4} xs={12}>
                    <DeliveryInfoPanel taskId={taskId} />
                </Grid>
                <Grid item lg={4} xs={12}>
                    <ArgumentPanel taskId={taskId} />
                </Grid>
                <Grid item lg={4} xs={12}>
                    <ResultCard taskId={taskId} />
                </Grid>
            </Grid>
        </Box>
    )
}

export default TaskPage
