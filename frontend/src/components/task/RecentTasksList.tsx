import TaskAvatar from "@components/task/TaskAvatar"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemAvatar from "@mui/material/ListItemAvatar"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemText from "@mui/material/ListItemText"
import { useStateStore } from "@stores/useStateStore"
import React, { useMemo } from "react"
import { Link } from "react-router-dom"

interface RecentTasksListProps {
    count?: number
}

const RecentTasksList: React.FC<RecentTasksListProps> = ({ count }) => {
    const tasks = useStateStore((state) => state.tasks)
    const sortedTasks = useMemo(
        () =>
            tasks
                .map((t) => t)
                .sort((a, b) => (a.sentAt > b.sentAt ? -1 : 1))
                .slice(0, count || 10),
        [tasks, count]
    )

    return (
        <List>
            {sortedTasks.map((task) => (
                <ListItem key={task.id} disablePadding>
                    <ListItemButton component={Link} to={`/tasks/${task.id}`}>
                        <ListItemAvatar>
                            <TaskAvatar taskId={task.id} type={task.type} status={task.state} disableLink />
                        </ListItemAvatar>
                        <ListItemText primary={task.type} secondary={task.worker} />
                    </ListItemButton>
                </ListItem>
            ))}
        </List>
    )
}
export default RecentTasksList
