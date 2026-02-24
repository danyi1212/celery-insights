import TaskAvatar from "@components/task/TaskAvatar"
import PendingIcon from "@mui/icons-material/Pending"
import Chip from "@mui/material/Chip"
import Tooltip from "@mui/material/Tooltip"
import { TaskRequest } from "@services/server"
import React from "react"

interface ProcessChipProps {
    processId: number
    task?: TaskRequest
}

const ProcessChip: React.FC<ProcessChipProps> = ({ processId, task }) => {
    return (
        <Tooltip title="Child Process ID" arrow>
            <Chip
                label={processId}
                variant="outlined"
                avatar={
                    task ? (
                        <TaskAvatar taskId={task.id} type={task.type} />
                    ) : (
                        <Tooltip title="Sleeping" arrow placement="left">
                            <PendingIcon />
                        </Tooltip>
                    )
                }
            />
        </Tooltip>
    )
}
export default ProcessChip
