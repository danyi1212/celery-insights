import { cn } from "@lib/utils"
import React from "react"

interface WorkerStatusProps {
  status?: string
}

const WorkerStatus: React.FC<WorkerStatusProps> = ({ status }) => (
  <span
    className={cn("text-base", {
      "text-foreground": status === "online",
      "text-destructive": status === "offline",
      "text-status-warning": status !== "online" && status !== "offline",
    })}
  >
    {status === "online" ? "Online" : status === "offline" ? "Offline" : "Unknown"}
  </span>
)

export default WorkerStatus
