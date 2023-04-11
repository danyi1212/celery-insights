import Panel from "@components/common/Panel"
import useWorkerRegisteredTasks from "@hooks/useWorkerRegisteredTasks"
import Avatar from "@mui/material/Avatar"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemAvatar from "@mui/material/ListItemAvatar"
import ListItemText from "@mui/material/ListItemText"
import { StateWorker } from "@utils/translateServerModels"
import React, { useMemo } from "react"
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
}

const TaskTypeListItem: React.FC<TaskTypeListItemProps> = ({ taskType }) => {
    const backgroundColor = useMemo(() => stc(taskType), [taskType])
    const acronym = useMemo(() => acronymize(taskType), [taskType])
    return (
        <ListItem>
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
        </ListItem>
    )
}

const RegisteredTasksPanel: React.FC<RegisteredTasksPanelProps> = ({ worker }) => {
    const { tasks, isLoading, error } = useWorkerRegisteredTasks(worker)
    return (
        <Panel title="Registered Task Types" loading={isLoading} error={error}>
            <List>
                {tasks?.map((taskType) => (
                    <TaskTypeListItem key={taskType} taskType={taskType} />
                ))}
            </List>
        </Panel>
    )
}

export default RegisteredTasksPanel
