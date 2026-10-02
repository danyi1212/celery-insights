import { Badge } from "@components/ui/badge"
import { cn } from "@lib/utils"
import { TaskState } from "@/types/surreal-records"
import { Ban, Check, CircleAlert, CircleMinus, CirclePlay, Clock3, RotateCw, X } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface TaskStateBadgeProps {
  state: TaskState | string
  className?: string
}

interface BadgeMeta {
  icon: LucideIcon
  className: string
}

const badgeMeta: Record<string, BadgeMeta> = {
  [TaskState.PENDING]: {
    icon: Clock3,
    className: "border-status-neutral/30 bg-status-neutral/10 text-status-neutral",
  },
  [TaskState.RECEIVED]: {
    icon: Clock3,
    className: "border-status-info/30 bg-status-info/10 text-status-info",
  },
  [TaskState.STARTED]: {
    icon: CirclePlay,
    className: "border-status-info/30 bg-status-info/10 text-status-info",
  },
  [TaskState.SUCCESS]: {
    icon: Check,
    className: "border-status-success/30 bg-status-success/10 text-status-success",
  },
  [TaskState.FAILURE]: {
    icon: CircleAlert,
    className: "border-status-danger/30 bg-status-danger/10 text-status-danger",
  },
  [TaskState.RETRY]: {
    icon: RotateCw,
    className: "border-status-warning/30 bg-status-warning/10 text-status-warning",
  },
  [TaskState.REVOKED]: {
    icon: CircleMinus,
    className: "border-status-neutral/30 bg-status-neutral/10 text-status-neutral",
  },
  [TaskState.REJECTED]: {
    icon: Ban,
    className: "border-status-danger/30 bg-status-danger/10 text-status-danger",
  },
  [TaskState.IGNORED]: {
    icon: X,
    className: "border-status-neutral/30 bg-status-neutral/10 text-status-neutral",
  },
}

export default function TaskStateBadge({ state, className }: TaskStateBadgeProps) {
  const meta = badgeMeta[state] ?? badgeMeta[TaskState.PENDING]
  const Icon = meta.icon

  return (
    <Badge variant="outline" className={cn("gap-1.5 border font-semibold", meta.className, className)}>
      <Icon className="size-3.5" />
      {state}
    </Badge>
  )
}
