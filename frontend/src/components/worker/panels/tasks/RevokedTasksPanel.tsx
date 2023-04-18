import AnimatedList from "@components/common/AnimatedList"
import AnimatedListItem from "@components/common/AnimatedListItem"
import Panel, { PanelProps } from "@components/common/Panel"
import TaskAvatar from "@components/task/TaskAvatar"
import useWorkerRevokedTasks from "@hooks/worker/useWorkerRevokedTasks"
import ReadMoreIcon from "@mui/icons-material/ReadMore"
import Box from "@mui/material/Box"
import ListItemAvatar from "@mui/material/ListItemAvatar"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction"
import ListItemText from "@mui/material/ListItemText"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import { useStateStore } from "@stores/useStateStore"
import React, { useCallback } from "react"
import { Link } from "react-router-dom"

interface RevokedTasksPanelProps {
    hostname: string
}

interface RevokedTaskListItemProps extends Omit<PanelProps, "title"> {
    taskId: string
}

const RevokedTaskListItem: React.FC<RevokedTaskListItemProps> = ({ taskId }) => {
    const task = useStateStore(useCallback((state) => state.tasks.get(taskId), [taskId]))
    return (
        <AnimatedListItem disablePadding>
            <ListItemButton component={Link} to={`/tasks/${taskId}`}>
                <ListItemAvatar>
                    <TaskAvatar taskId={taskId} type={task?.type} status={task?.state} disableLink />
                </ListItemAvatar>
                <ListItemText primary={task?.type || "Unknown task"} secondary={taskId} />
                <ListItemSecondaryAction>
                    <Tooltip title="View task...">
                        <ReadMoreIcon />
                    </Tooltip>
                </ListItemSecondaryAction>
            </ListItemButton>
        </AnimatedListItem>
    )
}

const RevokedTasksPanel: React.FC<RevokedTasksPanelProps> = ({ hostname, ...props }) => {
    const { tasks, isLoading, error } = useWorkerRevokedTasks(hostname)
    return (
        <Panel title="Revoked Tasks" loading={isLoading} error={error} {...props}>
            {tasks && tasks.length > 0 ? (
                <AnimatedList disablePadding>
                    {tasks.map((taskId) => (
                        <RevokedTaskListItem key={taskId} taskId={taskId} />
                    ))}
                </AnimatedList>
            ) : (
                <Box display="flex" justifyContent="center" alignItems="center" p={3}>
                    <Typography variant="h4" align="center">
                        Revoke list is empty
                    </Typography>
                </Box>
            )}
        </Panel>
    )
}

export default RevokedTasksPanel
