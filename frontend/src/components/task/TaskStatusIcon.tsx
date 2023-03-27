import CancelIcon from "@mui/icons-material/Cancel"
import ChangeCircleIcon from "@mui/icons-material/ChangeCircle"
import CheckCircleIcon from "@mui/icons-material/CheckCircle"
import ErrorIcon from "@mui/icons-material/Error"
import PlayCircleIcon from "@mui/icons-material/PlayCircle"
import RemoveCircleIcon from "@mui/icons-material/RemoveCircle"
import WatchLaterIcon from "@mui/icons-material/WatchLater"
import { SvgIconProps } from "@mui/material"
import Tooltip from "@mui/material/Tooltip"
import { TaskState } from "@services/server"
import React from "react"

interface TaskStatusIconProps extends SvgIconProps {
    status: TaskState
}

interface StateIconMeta {
    icon: React.ElementType
    color: SvgIconProps["color"]
    tooltip: string
}

const stateMeta: Record<TaskState, StateIconMeta> = {
    [TaskState.PENDING]: { icon: WatchLaterIcon, color: "disabled", tooltip: "Pending" },
    [TaskState.RECEIVED]: { icon: WatchLaterIcon, color: "info", tooltip: "Received" },
    [TaskState.STARTED]: { icon: PlayCircleIcon, color: "info", tooltip: "Started" },
    [TaskState.SUCCESS]: { icon: CheckCircleIcon, color: "success", tooltip: "Success" },
    [TaskState.FAILURE]: { icon: ErrorIcon, color: "error", tooltip: "Failure" },
    [TaskState.IGNORED]: { icon: CancelIcon, color: "error", tooltip: "Ignored" },
    [TaskState.REJECTED]: { icon: CancelIcon, color: "error", tooltip: "Rejected" },
    [TaskState.REVOKED]: { icon: RemoveCircleIcon, color: "warning", tooltip: "Revoked" },
    [TaskState.RETRY]: { icon: ChangeCircleIcon, color: "warning", tooltip: "Retry" },
}

const TaskStatusIcon: React.FC<TaskStatusIconProps> = ({ status, ...props }) => {
    const meta = stateMeta[status]
    return (
        <Tooltip title={meta.tooltip} arrow>
            <meta.icon color={meta.color} {...props} />
        </Tooltip>
    )
}

export default TaskStatusIcon
