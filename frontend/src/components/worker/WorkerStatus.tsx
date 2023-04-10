import Typography from "@mui/material/Typography"
import React, { useMemo } from "react"

interface WorkerStatusProps {
    heartbeatExpires?: Date
}

const WorkerStatus: React.FC<WorkerStatusProps> = ({ heartbeatExpires }) => {
    const { status, color } = useMemo(() => {
        if (!heartbeatExpires) return { status: "Unknown", color: "warning" }
        const secondsLeft = Math.floor(heartbeatExpires.getTime() - Date.now()) / 1000
        if (secondsLeft < 0) {
            return {
                status: `Offline`,
                color: "danger",
            }
        } else if (secondsLeft < 1) {
            return {
                status: `Unresponsive`,
                color: "warning",
            }
        } else {
            return { status: "Online", color: "inherit" }
        }
    }, [heartbeatExpires])
    return (
        <Typography variant="body1" component="span" color={color}>
            {status}
        </Typography>
    )
}

export default WorkerStatus
