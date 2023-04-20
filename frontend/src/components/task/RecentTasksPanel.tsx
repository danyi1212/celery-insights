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
import { StateTask } from "@utils/translateServerModels"
import { format } from "date-fns"
import React from "react"
import { Link as RouterLink, Link } from "react-router-dom"

const RecentTasksPanel: React.FC<Omit<PanelProps, "title">> = (props) => {
    const recentTasks = useStateStore(
        (state) => state.recentTaskIds.map((taskId) => state.tasks.get(taskId)).filter((task) => task) as StateTask[]
    )

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
                {recentTasks.map((task, index) => (
                    <AnimatedListItem key={index} disablePadding>
                        <ListItemButton component={Link} to={`/tasks/${task.id}`}>
                            <ListItemAvatar>
                                <TaskAvatar taskId={task.id} type={task.type} status={task.state} disableLink />
                            </ListItemAvatar>
                            <ListItemText
                                primary={task.type}
                                secondary={"Sent at " + format(task.sentAt, "HH:mm:ss")}
                            />
                            <ListItemSecondaryAction>
                                <Tooltip title="View task...">
                                    <ReadMoreIcon />
                                </Tooltip>
                            </ListItemSecondaryAction>
                        </ListItemButton>
                    </AnimatedListItem>
                ))}
            </AnimatedList>
        </Panel>
    )
}
export default RecentTasksPanel
