import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useSurrealDB, type IngestionStatus } from "@components/surrealdb-provider"
import { CheckCircle2, AlertCircle, RotateCw, Radio, Eye, Pause, CircleDot } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { ConnectionStatus } from "surrealdb"

interface StatusMeta {
    label: string
    icon: React.ReactElement
}

const connectionMeta: Record<ConnectionStatus, StatusMeta> = {
    connected: {
        label: "Connected",
        icon: <CheckCircle2 className="size-4 text-status-success" />,
    },
    connecting: {
        label: "Connecting...",
        icon: <RotateCw className="size-4 animate-spin text-status-warning" />,
    },
    reconnecting: {
        label: "Reconnecting...",
        icon: <RotateCw className="size-4 animate-spin text-status-warning" />,
    },
    disconnected: {
        label: "Disconnected",
        icon: <AlertCircle className="size-4 text-status-danger" />,
    },
}

const ingestionMeta: Record<IngestionStatus, StatusMeta> = {
    leader: {
        label: "Ingesting",
        icon: <Radio className="size-4 text-status-success" />,
    },
    standby: {
        label: "Standby",
        icon: <Pause className="size-4 text-status-info" />,
    },
    "read-only": {
        label: "Read-only",
        icon: <Eye className="size-4 text-status-warning" />,
    },
    disabled: {
        label: "Disabled",
        icon: <CircleDot className="size-4 text-muted-foreground" />,
    },
}

const ConnectionStatusIndicator = () => {
    const { status, ingestionStatus } = useSurrealDB()
    const [textVisible, setTextVisible] = useState(true)
    const prevStatusRef = useRef(status)

    const connMeta = connectionMeta[status]
    const ingMeta = ingestionMeta[ingestionStatus]

    // Auto-hide text after 5 seconds, re-show on status change
    useEffect(() => {
        setTextVisible(true)
        const timer = setTimeout(() => setTextVisible(false), 5000)
        return () => clearTimeout(timer)
    }, [status, ingestionStatus])

    // Track reconnection recovery
    useEffect(() => {
        if (prevStatusRef.current === "reconnecting" && status === "connected") {
            // Could show a toast here if a toast library is added
        }
        prevStatusRef.current = status
    }, [status])

    const tooltipText = status === "connected" ? `${connMeta.label} \u2014 ${ingMeta.label}` : `${connMeta.label}`

    return (
        <div className="flex items-center p-1">
            <div className="overflow-hidden">
                <div
                    className="transition-all duration-300 flex items-center gap-1.5"
                    style={{
                        transform: textVisible ? "translateX(0)" : "translateX(100%)",
                        opacity: textVisible ? 1 : 0,
                    }}
                >
                    {status === "connected" && ingestionStatus !== "leader" && (
                        <span className="text-xs text-muted-foreground">{ingMeta.label}</span>
                    )}
                    <span className="text-xs text-muted-foreground">{connMeta.label}</span>
                </div>
            </div>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="flex items-center gap-1">
                        {status === "connected" && ingestionStatus !== "leader" && (
                            <span className="flex items-center">{ingMeta.icon}</span>
                        )}
                        <span className="flex items-center">{connMeta.icon}</span>
                    </span>
                </TooltipTrigger>
                <TooltipContent>{tooltipText}</TooltipContent>
            </Tooltip>
        </div>
    )
}

const ReadOnlyBanner = () => {
    const { ingestionStatus } = useSurrealDB()

    if (ingestionStatus !== "read-only") return null

    return (
        <div className="border-b border-status-warning/20 bg-status-warning/10 px-4 py-1.5 text-center text-xs text-status-warning">
            <Eye className="inline-block size-3.5 mr-1.5 -translate-y-px" />
            Read-only mode — viewing existing data, no live ingestion
        </div>
    )
}

export { ConnectionStatusIndicator, ReadOnlyBanner }
