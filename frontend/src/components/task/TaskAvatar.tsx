import IdentityIcon from "@components/common/IdentityIcon"
import TaskStatusIcon from "@components/task/TaskStatusIcon"
import Avatar, { AvatarProps } from "@mui/material/Avatar"
import Badge from "@mui/material/Badge"
import Tooltip from "@mui/material/Tooltip"
import { TaskState } from "@services/server"
import { getBrightness } from "@utils/colorUtils"
import React, { useMemo } from "react"
import { Link } from "react-router-dom"
import stc from "string-to-color"

interface TaskAvatarProps extends AvatarProps {
    taskId: string
    type: string | undefined
    status?: TaskState
}

const TaskAvatar: React.FC<TaskAvatarProps> = ({ taskId, status, type, ...props }) => {
    const backgroundColor = useMemo(() => stc(type), [type])
    const iconBrightness = useMemo(() => 100 - getBrightness(backgroundColor), [backgroundColor])
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
                <Tooltip
                    title={
                        <span>
                            {taskId}
                            <br />
                            {type}
                        </span>
                    }
                    placement="right"
                    arrow
                    describeChild
                >
                    <Avatar alt={taskId} {...props} sx={{ backgroundColor: backgroundColor, ...props.sx }}>
                        <IdentityIcon username={taskId} lightness={iconBrightness} />
                    </Avatar>
                </Tooltip>
            </Badge>
        </Link>
    )
}

export default TaskAvatar