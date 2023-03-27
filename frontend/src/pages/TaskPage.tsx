import TaskPageHeader from "@components/task/TaskPageHeader"
import WorkflowGraph, { WorkflowChartType } from "@components/task/WorkflowGraph"
import useTaskResult from "@hooks/useTaskResult"
import useTaskState from "@hooks/useTaskState"
import Box from "@mui/material/Box"
import CircularProgress from "@mui/material/CircularProgress"
import Typography from "@mui/material/Typography"
import React from "react"
import { useParams } from "react-router-dom"

const TaskPage: React.FC = () => {
    const { taskId } = useParams() as { taskId: string }
    const { task, loading } = useTaskState(taskId)
    const { taskResult } = useTaskResult(taskId)

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
            <Typography component="pre" overflow="auto">
                {JSON.stringify(task, null, 2)}
            </Typography>
            <Typography component="pre" overflow="auto">
                {JSON.stringify(taskResult, null, 2)}
            </Typography>
        </Box>
    )
}

export default TaskPage
