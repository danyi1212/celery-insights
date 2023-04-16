import TaskAvatar from "@components/task/TaskAvatar"
import { WorkflowChartType } from "@components/workflow/WorkflowGraph"
import AccountTreeIcon from "@mui/icons-material/AccountTree"
import ViewTimelineIcon from "@mui/icons-material/ViewTimeline"
import Box from "@mui/material/Box"
import Paper from "@mui/material/Paper"
import Stack from "@mui/material/Stack"
import ToggleButton from "@mui/material/ToggleButton"
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import Toolbar from "@mui/material/Toolbar"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import { StateTask } from "@utils/translateServerModels"
import React from "react"

interface TaskPageHeaderProps {
    task: StateTask
    chartType: WorkflowChartType
    setChartType: (type: WorkflowChartType) => void
}

const TaskPageHeader: React.FC<TaskPageHeaderProps> = ({ task, chartType, setChartType }) => {
    return (
        <Toolbar component={Paper} elevation={3} sx={{ pt: 0.5, pb: 1, borderRadius: 0 }}>
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
    )
}
export default TaskPageHeader
