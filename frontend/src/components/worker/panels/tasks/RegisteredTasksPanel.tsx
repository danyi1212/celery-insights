import Panel from "@components/common/Panel"
import useWorkerRegisteredTasks from "@hooks/useWorkerRegisteredTasks"
import Avatar from "@mui/material/Avatar"
import Box from "@mui/material/Box"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemAvatar from "@mui/material/ListItemAvatar"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemText from "@mui/material/ListItemText"
import Typography from "@mui/material/Typography"
import { StateWorker } from "@utils/translateServerModels"
import React, { useMemo } from "react"
import { Link } from "react-router-dom"
import stc from "string-to-color"

interface RegisteredTasksPanelProps {
    worker: StateWorker
}

const acronymize = (str: string): string =>
    str
        .split(/\W+/)
        .map((word) => word.charAt(0).toUpperCase())
        .join("")
        .slice(-2)

interface TaskTypeListItemProps {
    taskType: string
    workerId: string
}

const TaskTypeListItem: React.FC<TaskTypeListItemProps> = ({ taskType, workerId }) => {
    const backgroundColor = useMemo(() => stc(taskType), [taskType])
    const acronym = useMemo(() => acronymize(taskType), [taskType])
    return (
        <ListItem disablePadding>
            <ListItemButton
                component={Link}
                to={{
                    pathname: "/explorer",
                    search: new URLSearchParams({ type: taskType, worker: workerId }).toString(),
                }}
            >
                <ListItemAvatar>
                    <Avatar
                        sx={{
                            backgroundColor: backgroundColor,
                            color: (theme) => theme.palette.getContrastText(backgroundColor),
                        }}
                    >
                        {acronym}
                    </Avatar>
                </ListItemAvatar>
                <ListItemText primary={taskType} />
            </ListItemButton>
        </ListItem>
    )
}

const RegisteredTasksPanel: React.FC<RegisteredTasksPanelProps> = ({ worker }) => {
    const { tasks, isLoading, error } = useWorkerRegisteredTasks(worker)
    return (
        <Panel title="Registered Task Types" loading={isLoading} error={error}>
            {tasks && tasks.length > 0 ? (
                <List disablePadding>
                    {tasks.map((taskType) => (
                        <TaskTypeListItem key={taskType} taskType={taskType} workerId={worker.id} />
                    ))}
                </List>
            ) : (
                <Box display="flex" justifyContent="center" alignItems="center" p={3}>
                    <Typography variant="h4" align="center">
                        No registered tasks found
                    </Typography>
                </Box>
            )}
        </Panel>
    )
}

export default RegisteredTasksPanel
