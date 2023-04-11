import Panel from "@components/common/Panel"
import TaskAvatar from "@components/task/TaskAvatar"
import useWorkerRevokedTasks from "@hooks/useWorkerRevokedTasks"
import Box from "@mui/material/Box"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemAvatar from "@mui/material/ListItemAvatar"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemText from "@mui/material/ListItemText"
import Typography from "@mui/material/Typography"
import { useStateStore } from "@stores/useStateStore"
import { StateWorker } from "@utils/translateServerModels"
import React, { useCallback } from "react"
import { Link } from "react-router-dom"

interface RevokedTasksPanelProps {
    worker: StateWorker
}

interface RevokedTaskListItemProps {
    taskId: string
}

const RevokedTaskListItem: React.FC<RevokedTaskListItemProps> = ({ taskId }) => {
    const task = useStateStore(useCallback((state) => state.tasks.get(taskId), [taskId]))
    return (
        <ListItem disablePadding>
            <ListItemButton component={Link} to={`/tasks/${taskId}`}>
                <ListItemAvatar>
                    <TaskAvatar taskId={taskId} type={task?.type} status={task?.state} disableLink />
                </ListItemAvatar>
                <ListItemText primary={task?.type || "Unknown task"} secondary={taskId} />
            </ListItemButton>
        </ListItem>
    )
}

const RevokedTasksPanel: React.FC<RevokedTasksPanelProps> = ({ worker }) => {
    const { tasks, isLoading, error } = useWorkerRevokedTasks(worker)
    return (
        <Panel title="Revoked Tasks" loading={isLoading} error={error}>
            {tasks && tasks.length > 0 ? (
                <List disablePadding>
                    {tasks.map((taskId) => (
                        <RevokedTaskListItem key={taskId} taskId={taskId} />
                    ))}
                </List>
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
