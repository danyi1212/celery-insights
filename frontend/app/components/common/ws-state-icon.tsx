import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { CheckCircle2, AlertCircle, RotateCw, Zap } from "lucide-react"
import React, { useEffect, useState } from "react"
import { ReadyState } from "react-use-websocket"

interface Meta {
    description: string
    icon: React.ReactElement
}

const statusMeta: Record<ReadyState, Meta> = {
    [ReadyState.OPEN]: {
        description: "Connected",
        icon: <CheckCircle2 className="size-5 text-green-500" />,
    },
    [ReadyState.CLOSED]: {
        description: "Disconnected",
        icon: <AlertCircle className="size-5 text-red-500" />,
    },
    [ReadyState.CLOSING]: {
        description: "Disconnecting...",
        icon: <RotateCw className="size-5 text-yellow-500" />,
    },
    [ReadyState.CONNECTING]: {
        description: "Connecting...",
        icon: <RotateCw className="size-5 text-yellow-500" />,
    },
    [ReadyState.UNINSTANTIATED]: {
        description: "Starting...",
        icon: <RotateCw className="size-5 text-yellow-500" />,
    },
}

const demoMeta: Meta = {
    description: "Demo Mode",
    icon: <Zap className="size-5 text-primary" />,
}

interface WsStateIconProps {
    state: ReadyState
    isDemo?: boolean
}

const WsStateIcon: React.FC<WsStateIconProps> = ({ state, isDemo }) => {
    const meta: Meta = isDemo ? demoMeta : statusMeta[state]
    const [isOpen, setOpen] = useState(true)

    useEffect(() => {
        setOpen(true)
        const token = setTimeout(() => setOpen(false), 1000 * 5)
        return () => clearTimeout(token)
    }, [state, isDemo])

    return (
        <div className="flex items-center p-1">
            <div className="overflow-hidden">
                <div
                    className="transition-all duration-300"
                    style={{
                        transform: isOpen ? "translateX(0)" : "translateX(100%)",
                        opacity: isOpen ? 1 : 0,
                    }}
                >
                    <span className="px-2.5 py-1 text-sm">{meta.description}</span>
                </div>
            </div>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="flex items-center">{meta.icon}</span>
                </TooltipTrigger>
                <TooltipContent>{meta.description}</TooltipContent>
            </Tooltip>
        </div>
    )
}
export default WsStateIcon
