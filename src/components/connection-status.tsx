import { useSurrealDB, type IngestionStatus } from "@components/surrealdb-provider"
import { Badge } from "@components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { cn } from "@lib/utils"
import useSettingsStore from "@stores/use-settings-store"
import { AlertCircle, CheckCircle2, CircleDot, Eye, Pause, RotateCw, Zap } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useEffect, useState } from "react"
import type { ConnectionStatus } from "surrealdb"

interface IndicatorMeta {
  label: string
  detail: string
  icon: LucideIcon
  className: string
  iconClassName?: string
  keepExpanded?: boolean
}

const connectionMeta: Record<ConnectionStatus, IndicatorMeta> = {
  connected: {
    label: "Connected",
    detail: "Live database connection is healthy.",
    icon: CheckCircle2,
    className: "border-status-success/30 bg-status-success/10 text-status-success",
  },
  connecting: {
    label: "Connecting",
    detail: "Opening the live database connection.",
    icon: RotateCw,
    className: "border-status-warning/30 bg-status-warning/10 text-status-warning",
    iconClassName: "animate-spin",
    keepExpanded: true,
  },
  reconnecting: {
    label: "Reconnecting",
    detail: "Trying to restore the live database connection.",
    icon: RotateCw,
    className: "border-status-warning/30 bg-status-warning/10 text-status-warning",
    iconClassName: "animate-spin",
    keepExpanded: true,
  },
  disconnected: {
    label: "Disconnected",
    detail: "Live database connection is unavailable.",
    icon: AlertCircle,
    className: "border-status-danger/30 bg-status-danger/10 text-status-danger",
    keepExpanded: true,
  },
}

const connectedIngestionMeta: Record<IngestionStatus, IndicatorMeta> = {
  leader: {
    label: "Connected",
    detail: "Live data is connected and ingestion is active.",
    icon: CheckCircle2,
    className: "border-status-success/30 bg-status-success/10 text-status-success",
  },
  standby: {
    label: "Standby",
    detail: "Connected to live data, but this instance is not ingesting.",
    icon: Pause,
    className: "border-status-info/30 bg-status-info/10 text-status-info",
    keepExpanded: true,
  },
  "read-only": {
    label: "Read-only",
    detail: "Connected to stored data without live ingestion.",
    icon: Eye,
    className: "border-status-warning/30 bg-status-warning/10 text-status-warning",
    keepExpanded: true,
  },
  disabled: {
    label: "Connected",
    detail: "Connected to data with ingestion disabled.",
    icon: CircleDot,
    className: "border-border bg-muted text-muted-foreground",
  },
}

const demoMeta: IndicatorMeta = {
  label: "Demo mode",
  detail: "Using the embedded demo database and sample events.",
  icon: Zap,
  className: "border-primary/30 bg-primary/10 text-primary",
  keepExpanded: true,
}

const LABEL_HIDE_DELAY_MS = 5000
const COLLAPSED_WIDTH_REM = 2
const LABEL_WIDTH_CH_BUFFER = 5.5

const getIndicatorMeta = (
  status: ConnectionStatus,
  ingestionStatus: IngestionStatus,
  isDemo: boolean,
): IndicatorMeta => {
  if (isDemo) return demoMeta
  if (status === "connected") return connectedIngestionMeta[ingestionStatus]
  return connectionMeta[status]
}

const ConnectionStatusIndicator = () => {
  const { status, ingestionStatus, error } = useSurrealDB()
  const isDemo = useSettingsStore((state) => state.demo)
  const meta = getIndicatorMeta(status, ingestionStatus, isDemo)
  const Icon = meta.icon
  const tooltipText = error ? `${meta.detail} Error: ${error.message}` : meta.detail
  const expandedWidth = `${meta.label.length + LABEL_WIDTH_CH_BUFFER}ch`
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    setExpanded(true)

    if (meta.keepExpanded) return

    const timeoutId = window.setTimeout(() => setExpanded(false), LABEL_HIDE_DELAY_MS)
    return () => window.clearTimeout(timeoutId)
  }, [meta.keepExpanded, meta.label])

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          data-testid="header-connection-status"
          aria-label={meta.label}
          data-expanded={expanded ? "true" : "false"}
          style={{
            width: expanded ? expandedWidth : `${COLLAPSED_WIDTH_REM}rem`,
          }}
          className={cn(
            "inline-flex h-8 items-center overflow-hidden text-xs font-medium transition-[width,padding,background-color,border-color,color] duration-300 ease-out",
            expanded ? "max-w-40 gap-1.5 px-2.5 py-1" : "shrink-0 justify-center gap-0 px-0 py-0",
            meta.className,
          )}
        >
          <Icon className={cn("size-4 shrink-0", meta.iconClassName)} />
          <span
            className={cn(
              "whitespace-nowrap transition-[width,opacity] duration-500 ease-out",
              expanded ? "w-auto opacity-100" : "w-0 opacity-0",
            )}
            aria-hidden={expanded ? undefined : true}
          >
            {meta.label}
          </span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  )
}

const ReadOnlyBanner = () => {
  const { ingestionStatus, appConfig } = useSurrealDB()

  if (appConfig?.debugSnapshot?.enabled) {
    return (
      <div className="border-b border-status-warning/20 bg-status-warning/10 px-4 py-1.5 text-center text-xs text-status-warning">
        <Eye className="mr-1.5 inline-block size-3.5 -translate-y-px" />
        Snapshot replay mode - viewing an offline, read-only debug bundle
      </div>
    )
  }

  if (ingestionStatus !== "read-only") return null

  return (
    <div className="border-b border-status-warning/20 bg-status-warning/10 px-4 py-1.5 text-center text-xs text-status-warning">
      <Eye className="mr-1.5 inline-block size-3.5 -translate-y-px" />
      Read-only mode - viewing existing data, no live ingestion
    </div>
  )
}

export { ConnectionStatusIndicator, ReadOnlyBanner, getIndicatorMeta }
