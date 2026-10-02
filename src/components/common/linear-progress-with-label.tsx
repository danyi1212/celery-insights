import { Progress } from "@components/ui/progress"
import React, { useMemo } from "react"

interface LinearProgressWithLabelProps {
  value: number
  max?: number
  min?: number
  percentageLabel?: boolean
}

const LinearProgressWithLabel: React.FC<LinearProgressWithLabelProps> = ({
  value,
  max = 100,
  min = 0,
  percentageLabel,
}) => {
  const percentage = useMemo(() => Math.round(((value - min) * 100) / (max - min)), [value, min, max])
  const label = useMemo(
    () => (percentageLabel ? `${Math.round(percentage)}%` : `${value}/${max}`),
    [percentageLabel, percentage, max, value],
  )
  return (
    <div className="flex items-center">
      <div className="mr-1 w-full">
        <Progress value={percentage} />
      </div>
      <span className="min-w-[35px] text-sm text-muted-foreground">{label}</span>
    </div>
  )
}

export default LinearProgressWithLabel
