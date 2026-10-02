import { Button } from "@components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { RotateCw, Zap } from "lucide-react"

interface LiveRefreshButtonProps {
  isLive: boolean
  isFetching?: boolean
  updatedAt?: number
  onRefresh: () => void
  label?: string
}

const LiveRefreshButton = ({
  isLive,
  isFetching = false,
  updatedAt = 0,
  onRefresh,
  label = "Refresh data",
}: LiveRefreshButtonProps) => {
  const tooltipLabel = updatedAt ? `Last updated ${new Date(updatedAt).toLocaleString()}` : label

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={label}
          onClick={onRefresh}
          className={isLive ? "border-primary/60 text-primary hover:border-primary hover:text-primary" : undefined}
        >
          {isLive ? <Zap className="size-4" /> : <RotateCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltipLabel}</TooltipContent>
    </Tooltip>
  )
}

export default LiveRefreshButton
