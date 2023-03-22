import CancelIcon from "@mui/icons-material/Cancel"
import ChangeCircleIcon from "@mui/icons-material/ChangeCircle"
import CheckCircleIcon from "@mui/icons-material/CheckCircle"
import ErrorIcon from "@mui/icons-material/Error"
import HelpIcon from "@mui/icons-material/Help"
import PlayCircleIcon from "@mui/icons-material/PlayCircle"
import RemoveCircleIcon from "@mui/icons-material/RemoveCircle"
import WatchLaterIcon from "@mui/icons-material/WatchLater"
import { SvgIconProps } from "@mui/material"
import { TaskState } from "@services/server"
import React from "react"

interface TaskStatusIconProps {
    status: TaskState
    color?: SvgIconProps["color"]
}

const TaskStatusIcon: React.FC<TaskStatusIconProps> = ({ status, color }) => {
    switch (status) {
        case TaskState.PENDING:
            return <WatchLaterIcon color={color || "disabled"} />
        case TaskState.RECEIVED:
            return <WatchLaterIcon color={color || "info"} />
        case TaskState.STARTED:
            return <PlayCircleIcon color={color || "info"} />
        case TaskState.SUCCESS:
            return <CheckCircleIcon color={color || "success"} />
        case TaskState.FAILURE:
            return <ErrorIcon color={color || "error"} />
        case TaskState.IGNORED:
            return <CancelIcon color={color || "error"} />
        case TaskState.REJECTED:
            return <CancelIcon color={color || "error"} />
        case TaskState.REVOKED:
            return <RemoveCircleIcon color={color || "warning"} />
        case TaskState.RETRY:
            return <ChangeCircleIcon color={color || "warning"} />
        default:
            return <HelpIcon color={color || "disabled"} />
    }
}

export default TaskStatusIcon
