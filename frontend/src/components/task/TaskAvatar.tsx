import IdentityIcon from "@components/common/IdentityIcon"
import TaskStatusIcon from "@components/task/TaskStatusIcon"
import Avatar, { AvatarProps } from "@mui/material/Avatar"
import Badge from "@mui/material/Badge"
import Tooltip from "@mui/material/Tooltip"
import { TaskState } from "@services/server"
import React from "react"
import { Link } from "react-router-dom"

interface TaskAvatarProps extends AvatarProps {
    taskId: string
    status?: TaskState
}

const TaskAvatar: React.FC<TaskAvatarProps> = ({ taskId, status, ...props }) => {
    return (
        <Link to={`/tasks/${taskId}`}>
            <Badge
                overlap="circular"
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                badgeContent={
                    status ? (
                        <TaskStatusIcon
                            status={status}
                            fontSize="small"
                            sx={{
                                backgroundColor: (theme) => theme.palette.common.black,
                                borderRadius: "100%",
                            }}
                        />
                    ) : null
                }
                invisible={!status}
            >
                <Tooltip title={taskId} placement="right" arrow>
                    <Avatar sx={{ backgroundColor: (theme) => theme.palette.common.white }} alt={taskId} {...props}>
                        <IdentityIcon username={taskId} />
                    </Avatar>
                </Tooltip>
            </Badge>
        </Link>
    )
}

export default TaskAvatar
