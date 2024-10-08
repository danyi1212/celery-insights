import CopyLinkButton from "@components/common/CopyLinkButton"
import TaskAvatar from "@components/task/TaskAvatar"
import TaskTimer from "@components/task/TaskTimer"
import { WorkflowChartType } from "@components/workflow/WorkflowGraph"
import AccountTreeIcon from "@mui/icons-material/AccountTree"
import ViewTimelineIcon from "@mui/icons-material/ViewTimeline"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Paper from "@mui/material/Paper"
import Skeleton from "@mui/material/Skeleton"
import Stack from "@mui/material/Stack"
import ToggleButton from "@mui/material/ToggleButton"
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import Toolbar from "@mui/material/Toolbar"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import Zoom from "@mui/material/Zoom"
import { StateTask } from "@utils/translateServerModels"
import React, { useState } from "react"
import { Link } from "react-router-dom"

interface TaskPageHeaderProps {
    task: StateTask | undefined
    chartType: WorkflowChartType
    setChartType: (type: WorkflowChartType) => void
}

const TaskPageHeader: React.FC<TaskPageHeaderProps> = ({ task, chartType, setChartType }) => {
    const [isHover, setHover] = useState(false)
    return (
        <Toolbar
            id="task-header"
            component={Paper}
            elevation={3}
            sx={{ pt: 0.5, pb: 1, borderRadius: 0 }}
            onPointerEnter={() => setHover(true)}
            onPointerLeave={() => setHover(false)}
        >
            <Box pr={3}>
                {task === undefined ? (
                    <Skeleton variant="circular" width={40} height={40} />
                ) : (
                    <TaskAvatar taskId={task.id} type={task.type} status={task.state} />
                )}
            </Box>
            <Stack height={64} justifyContent="flex-end">
                {task ? (
                    <Typography variant="h5">{task.type}</Typography>
                ) : (
                    <Skeleton variant="rectangular" animation="wave" />
                )}
                {task ? (
                    <Typography variant="caption">{task.id}</Typography>
                ) : (
                    <Skeleton variant="rectangular" animation="wave" />
                )}
            </Stack>
            <Zoom in={isHover}>
                <div>
                    <CopyLinkButton sx={{ mx: 2 }} />
                </div>
            </Zoom>
            <Box flexGrow={1} />
            <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ justifyContent: "center" }}>
                {task && <TaskTimer task={task} sx={{ px: 1, my: "auto" }} align="center" />}
                <Button
                    variant="text"
                    color="secondary"
                    sx={{ px: 1, textTransform: "none" }}
                    disabled={!task?.type}
                    component={Link}
                    to={{
                        pathname: "/explorer",
                        search: new URLSearchParams({ type: task?.type || "" }).toString(),
                    }}
                >
                    Find similar tasks
                </Button>
                <ToggleButtonGroup
                    value={chartType}
                    onChange={(_, newValue) => newValue && setChartType(newValue)}
                    exclusive
                    size="small"
                    id="workflow-selector"
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
            </Stack>
        </Toolbar>
    )
}
export default TaskPageHeader
