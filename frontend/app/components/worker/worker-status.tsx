import { useNow } from "@hooks/use-now"
import { cn } from "@lib/utils"
import React, { useMemo } from "react"

interface WorkerStatusProps {
    heartbeatExpires?: Date
}

const WorkerStatus: React.FC<WorkerStatusProps> = ({ heartbeatExpires }) => {
    const now = useNow(heartbeatExpires ? 1000 : undefined)
    const { status, colorClass } = useMemo(() => {
        if (!heartbeatExpires) return { status: "Unknown", colorClass: "text-amber-500" }
        const secondsLeft = (heartbeatExpires.getTime() - now.getTime()) / 1000
        if (secondsLeft < 0) {
            return {
                status: `Offline`,
                colorClass: "text-destructive",
            }
        } else if (secondsLeft < 1) {
            return {
                status: `Unresponsive`,
                colorClass: "text-amber-500",
            }
        } else {
            return { status: "Online", colorClass: "text-foreground" }
        }
    }, [heartbeatExpires, now])
    return <span className={cn("text-base", colorClass)}>{status}</span>
}

export default WorkerStatus
