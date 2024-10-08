import Panel, { PanelProps } from "@components/common/Panel"
import useWorkerRegisteredTasks from "@hooks/worker/useWorkerRegisteredTasks"
import useWorkerStats from "@hooks/worker/useWorkerStats"
import ReadMoreIcon from "@mui/icons-material/ReadMore"
import Avatar from "@mui/material/Avatar"
import Badge from "@mui/material/Badge"
import Box from "@mui/material/Box"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemAvatar from "@mui/material/ListItemAvatar"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction"
import ListItemText from "@mui/material/ListItemText"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import React, { useMemo } from "react"
import { Link } from "react-router-dom"
import stc from "string-to-color"

interface RegisteredTasksPanelProps extends Omit<PanelProps, "title"> {
    workerId: string
    hostname: string
}

const acronymize = (str: string): string => {
    const words = str.split(/\W+/)
    const firstLetter = words[0].charAt(0).toUpperCase()
    const lastLetter = words[words.length - 1].charAt(0).toUpperCase()
    return firstLetter + lastLetter
}

interface TaskTypeListItemProps {
    taskType: string
    workerId: string
    count?: number
}

const TaskTypeListItem: React.FC<TaskTypeListItemProps> = ({ taskType, workerId, count }) => {
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
                    <Badge
                        overlap="circular"
                        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                        badgeContent={
                            <Tooltip title="Count of this task type processed by worker">
                                <Typography variant="caption">{count}</Typography>
                            </Tooltip>
                        }
                        invisible={!count}
                        color="primary"
                    >
                        <Avatar
                            sx={{
                                backgroundColor: backgroundColor,
                                color: (theme) => theme.palette.getContrastText(backgroundColor),
                            }}
                        >
                            {acronym}
                        </Avatar>
                    </Badge>
                </ListItemAvatar>
                <ListItemText primary={taskType} />
                <ListItemSecondaryAction>
                    <Tooltip title="View task...">
                        <ReadMoreIcon />
                    </Tooltip>
                </ListItemSecondaryAction>
            </ListItemButton>
        </ListItem>
    )
}

const RegisteredTasksPanel: React.FC<RegisteredTasksPanelProps> = ({ workerId, hostname, ...props }) => {
    const { tasks, isLoading, error } = useWorkerRegisteredTasks(hostname)
    const { stats } = useWorkerStats(hostname)
    return (
        <Panel title="Registered Task Types" loading={isLoading} error={error} {...props}>
            {tasks && tasks.length > 0 ? (
                <List disablePadding>
                    {tasks.map((taskType) => (
                        <TaskTypeListItem
                            key={taskType}
                            taskType={taskType}
                            workerId={workerId}
                            count={stats?.total?.[taskType]}
                        />
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
