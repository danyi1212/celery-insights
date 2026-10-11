import { cn } from "@lib/utils"
import React from "react"

interface WorkerStatusProps {
  status?: string
}

export const isWorkerOffline = (status?: string): boolean => status === "offline"

const WorkerStatus: React.FC<WorkerStatusProps> = ({ status }) => {
  const online = status === "online"
  const offline = isWorkerOffline(status)
  return (
    <span
      className={cn("text-base", {
        "text-foreground": online,
        "text-destructive": offline,
        "text-status-warning": !online && !offline,
      })}
    >
      {online ? "Online" : offline ? "Offline" : "Unknown"}
    </span>
  )
}

export default WorkerStatus
