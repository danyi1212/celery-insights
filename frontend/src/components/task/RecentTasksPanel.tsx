import AnimatedList from "@components/common/AnimatedList"
import AnimatedListItem from "@components/common/AnimatedListItem"
import Panel from "@components/common/Panel"
import TaskAvatar from "@components/task/TaskAvatar"
import Button from "@mui/material/Button"
import ListItemAvatar from "@mui/material/ListItemAvatar"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemText from "@mui/material/ListItemText"
import { useStateStore } from "@stores/useStateStore"
import { StateTask } from "@utils/translateServerModels"
import React, { startTransition, useEffect, useState } from "react"
import { Link as RouterLink, Link } from "react-router-dom"

interface RecentTasksPanelProps {
    count?: number
}

const RecentTasksPanel: React.FC<RecentTasksPanelProps> = ({ count }) => {
    const tasks = useStateStore((state) => state.tasks)
    const [sortedTasks, setSortedTasks] = useState<StateTask[] | null>(null)

    useEffect(
        () =>
            startTransition(() =>
                setSortedTasks(
                    tasks
                        .map((t) => t)
                        .sort((a, b) => (a.sentAt > b.sentAt ? -1 : 1))
                        .slice(0, count || 10)
                )
            ),
        [tasks, count]
    )

    return (
        <Panel
            id="recent-tasks"
            title="Recent Tasks"
            loading={sortedTasks === null}
            actions={
                <Button component={RouterLink} to="/explorer" variant="outlined" color="secondary">
                    View All
                </Button>
            }
        >
            <AnimatedList>
                {sortedTasks?.map((task) => (
                    <AnimatedListItem key={task.id} disablePadding>
                        <ListItemButton component={Link} to={`/tasks/${task.id}`}>
                            <ListItemAvatar>
                                <TaskAvatar taskId={task.id} type={task.type} status={task.state} disableLink />
                            </ListItemAvatar>
                            <ListItemText primary={task.type} secondary={task.worker} />
                        </ListItemButton>
                    </AnimatedListItem>
                ))}
            </AnimatedList>
        </Panel>
    )
}
export default RecentTasksPanel
