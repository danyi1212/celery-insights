import TaskAvatar from "@components/task/TaskAvatar"
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline"
import HighlightOffIcon from "@mui/icons-material/HighlightOff"
import ListItem from "@mui/material/ListItem"
import ListItemAvatar from "@mui/material/ListItemAvatar"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction"
import ListItemText from "@mui/material/ListItemText"
import Tooltip from "@mui/material/Tooltip"
import { TaskRequest } from "@services/server"
import React from "react"
import { Link } from "react-router-dom"

interface TaskListItemProps {
    task: TaskRequest
    subtitle?: string
}

const TaskListItem: React.FC<TaskListItemProps> = ({ task, subtitle }) => {
    return (
        <ListItem disablePadding>
            <ListItemButton component={Link} to={`/tasks/${task.id}`}>
                <ListItemAvatar>
                    <TaskAvatar taskId={task.id} type={task.type} disableLink />
                </ListItemAvatar>
                <ListItemText primary={task.type} secondary={subtitle} />
                <ListItemSecondaryAction>
                    {task.acknowledged ? (
                        <Tooltip title="Message Acknowledged" describeChild>
                            <CheckCircleOutlineIcon color="success" />
                        </Tooltip>
                    ) : (
                        <Tooltip title="Message Not Acknowledged" describeChild>
                            <HighlightOffIcon color="warning" />
                        </Tooltip>
                    )}
                </ListItemSecondaryAction>
            </ListItemButton>
        </ListItem>
    )
}
export default TaskListItem
