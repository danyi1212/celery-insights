import TaskAvatar from "@components/task/TaskAvatar"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemAvatar from "@mui/material/ListItemAvatar"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemText from "@mui/material/ListItemText"
import Typography from "@mui/material/Typography"
import { useStateStore } from "@stores/useStateStore"
import React, { useMemo } from "react"
import { Link } from "react-router-dom"

interface ErrorsListProps {
    count?: number
}

const ErrorsList: React.FC<ErrorsListProps> = ({ count }) => {
    const tasks = useStateStore((state) => state.tasks)
    const sortedTasks = useMemo(
        () =>
            tasks
                .map((task) => task)
                .filter((task) => task.exception)
                .sort((a, b) => (a.sentAt > b.sentAt ? -1 : 1))
                .slice(0, count || 10),
        [tasks, count]
    )

    if (sortedTasks.length === 0)
        return (
            <Typography variant="h4" align="center" mt={5}>
                No errors to report. <br />
                Keep calm and code on!
            </Typography>
        )

    return (
        <List>
            {sortedTasks.map((task) => (
                <ListItem key={task.id} disablePadding>
                    <ListItemButton component={Link} to={`/tasks/${task.id}`}>
                        <ListItemAvatar>
                            <TaskAvatar taskId={task.id} type={task.type} status={task.state} disableLink />
                        </ListItemAvatar>
                        <ListItemText primary={task.type} secondary={task.exception} />
                    </ListItemButton>
                </ListItem>
            ))}
        </List>
    )
}
export default ErrorsList
