import TaskAvatar from "@components/task/TaskAvatar"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemAvatar from "@mui/material/ListItemAvatar"
import ListItemText from "@mui/material/ListItemText"
import { useStateStore } from "@stores/useStateStore"
import React, { useMemo } from "react"

function HomePage() {
    const tasks = useStateStore((state) => state.tasks)
    const sortedTasks = useMemo(() => tasks.map((t) => t).sort((a, b) => (a.sentAt > b.sentAt ? -1 : 1)), [tasks])

    return (
        <List>
            {sortedTasks.map((task) => (
                <ListItem key={task.id}>
                    <ListItemAvatar>
                        <TaskAvatar taskId={task.id} type={task.type} status={task.state} />
                    </ListItemAvatar>
                    <ListItemText primary={task.type} secondary={task.worker} />
                </ListItem>
            ))}
        </List>
    )
}

export default HomePage
