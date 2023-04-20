import AnimatedList from "@components/common/AnimatedList"
import AnimatedListItem from "@components/common/AnimatedListItem"
import Panel, { PanelProps } from "@components/common/Panel"
import TaskAvatar from "@components/task/TaskAvatar"
import ReadMoreIcon from "@mui/icons-material/ReadMore"
import Button from "@mui/material/Button"
import ListItemAvatar from "@mui/material/ListItemAvatar"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction"
import ListItemText from "@mui/material/ListItemText"
import Tooltip from "@mui/material/Tooltip"
import { useStateStore } from "@stores/useStateStore"
import { format } from "date-fns"
import React, { useCallback } from "react"
import { Link as RouterLink, Link } from "react-router-dom"

const RecentTaskListItem: React.FC<{ taskId: string }> = ({ taskId }) => {
    const task = useStateStore(useCallback((store) => store.tasks.get(taskId), [taskId]))
    return (
        <AnimatedListItem disablePadding>
            <ListItemButton component={Link} to={`/tasks/${taskId}`}>
                <ListItemAvatar>
                    <TaskAvatar taskId={taskId} type={task?.type} status={task?.state} disableLink />
                </ListItemAvatar>
                <ListItemText
                    primary={task?.type || "Unknown"}
                    secondary={task?.sentAt && "Sent at " + format(task?.sentAt, "HH:mm:ss")}
                />
                <ListItemSecondaryAction>
                    <Tooltip title="View task...">
                        <ReadMoreIcon />
                    </Tooltip>
                </ListItemSecondaryAction>
            </ListItemButton>
        </AnimatedListItem>
    )
}

const RecentTasksPanel: React.FC<Omit<PanelProps, "title">> = (props) => {
    const recentTaskIds = useStateStore((state) => state.recentTaskIds)

    return (
        <Panel
            title="Recent Tasks"
            actions={
                <Button component={RouterLink} to="/explorer" variant="outlined" color="secondary">
                    View All
                </Button>
            }
            {...props}
        >
            <AnimatedList>
                {recentTaskIds.map((taskId, index) => (
                    <RecentTaskListItem key={index} taskId={taskId} />
                ))}
            </AnimatedList>
        </Panel>
    )
}
export default RecentTasksPanel
