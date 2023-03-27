import TaskAvatar from "@components/task/TaskAvatar"
import WorkflowGraph, { WorkflowChartType } from "@components/task/WorkflowGraph"
import useTaskResult from "@hooks/useTaskResult"
import useTaskState from "@hooks/useTaskState"
import AccountTreeIcon from "@mui/icons-material/AccountTree"
import ViewTimelineIcon from "@mui/icons-material/ViewTimeline"
import Box from "@mui/material/Box"
import CircularProgress from "@mui/material/CircularProgress"
import Stack from "@mui/material/Stack"
import ToggleButton from "@mui/material/ToggleButton"
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import Toolbar from "@mui/material/Toolbar"
import Tooltip from "@mui/material/Tooltip"
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
            <Toolbar>
                <Box pr={3}>
                    <TaskAvatar taskId={task.id} type={task.type} status={task.state} />
                </Box>
                <Stack height={64} justifyContent="flex-end">
                    <Typography variant="h5">{task.type}</Typography>
                    <Typography variant="caption">{task.id}</Typography>
                </Stack>
                <Box flexGrow={1} />
                <ToggleButtonGroup
                    value={chartType}
                    onChange={(_, newValue) => newValue && setChartType(newValue)}
                    exclusive
                    size="small"
                >
                    <ToggleButton value={WorkflowChartType.FLOWCHART}>
                        <Tooltip title="Flowchart">
                            <AccountTreeIcon />
                        </Tooltip>
                    </ToggleButton>
                    <ToggleButton value={WorkflowChartType.TIMELINE}>
                        <Tooltip title="Timeline">
                            <ViewTimelineIcon />
                        </Tooltip>
                    </ToggleButton>
                </ToggleButtonGroup>
            </Toolbar>
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
