import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { cn } from "@lib/utils"
import React from "react"

interface DetailItemProps {
  label: string
  value: React.ReactNode
  color?: string
  description?: string
}

const colorMap: Record<string, string> = {
  primary: "text-primary",
  secondary: "text-secondary",
  danger: "text-destructive",
  error: "text-destructive",
}

const DetailItem: React.FC<DetailItemProps> = ({ label, value, color, description }) => {
  const colorClass = colorMap[color || "primary"] || "text-primary"

  const labelNode = <span className={cn("pr-1 font-bold", colorClass)}>{`${label}:`}</span>

  const tooltip = description ? (
    <Tooltip>
      <TooltipTrigger asChild>{labelNode}</TooltipTrigger>
      <TooltipContent>{description}</TooltipContent>
    </Tooltip>
  ) : (
    labelNode
  )

  return (
    <div className="flex items-center whitespace-nowrap">
      {tooltip}
      <span className="flex-grow truncate">{value}</span>
    </div>
  )
}

export default DetailItem
