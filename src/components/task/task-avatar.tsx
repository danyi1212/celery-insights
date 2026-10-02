import IdentityIcon from "@components/common/identity-icon"
import TaskStatusIcon from "@components/task/task-status-icon"
import { Avatar } from "@components/ui/avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { cn } from "@lib/utils"
import { TaskState } from "@/types/surreal-records"
import { getBrightness } from "@utils/color-utils"
import React, { useMemo } from "react"
import { Link } from "@tanstack/react-router"
import stc from "string-to-color"

interface TaskAvatarProps extends React.ComponentProps<typeof Avatar> {
  taskId: string
  type: string | undefined | null
  status?: TaskState
  disableLink?: true
  tooltipSide?: "top" | "bottom"
  statusReveal?: "always" | "hover"
}

const TaskAvatar: React.FC<TaskAvatarProps> = ({
  taskId,
  status,
  type,
  disableLink,
  className,
  tooltipSide = "top",
  statusReveal = "always",
  ...props
}) => {
  const backgroundColor = useMemo(() => type && stc(type), [type])
  const iconBrightness = useMemo(() => backgroundColor && 100 - getBrightness(backgroundColor), [backgroundColor])
  const Wrapper = disableLink ? "div" : Link

  return (
    <Wrapper {...(!disableLink ? { to: `/tasks/${taskId}` as string } : {})}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="group/task-avatar relative inline-flex">
            <Avatar
              className={cn("size-10", className)}
              style={{ backgroundColor: backgroundColor || undefined }}
              {...props}
            >
              <IdentityIcon username={taskId} lightness={iconBrightness || 0} className="size-full" />
            </Avatar>
            {status && (
              <span
                className={cn(
                  "absolute -right-1 -bottom-1 z-10 inline-flex rounded-full bg-background transition-all duration-150",
                  statusReveal === "hover"
                    ? "pointer-events-none translate-y-0.5 scale-90 opacity-0 group-hover/task-avatar:translate-y-0 group-hover/task-avatar:scale-100 group-hover/task-avatar:opacity-100"
                    : "opacity-100",
                )}
              >
                <TaskStatusIcon status={status} iconClassName="size-4" />
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide}>
          <span>
            {taskId}
            <br />
            {type}
          </span>
        </TooltipContent>
      </Tooltip>
    </Wrapper>
  )
}

export default TaskAvatar
