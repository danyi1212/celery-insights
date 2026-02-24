import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { WebSocketState } from "@services/server"
import { Lock, Wifi, WifiOff } from "lucide-react"
import React from "react"

interface ClientConnectionStatusProps {
    state: WebSocketState
    isSecure: boolean
}

const ClientConnectionStatus: React.FC<ClientConnectionStatusProps> = ({ state, isSecure }) => {
    switch (state) {
        case WebSocketState._0:
            return (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className="relative flex items-center">
                            <Wifi className="size-5 text-blue-500 opacity-60" />
                            {isSecure && <Lock className="absolute -bottom-0.5 -right-0.5 size-2.5 text-blue-500" />}
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>{isSecure ? "Connecting with SSL" : "Connecting without SSL"}</TooltipContent>
                </Tooltip>
            )
        case WebSocketState._1:
            return (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className="relative flex items-center">
                            <Wifi className="size-5 text-yellow-500" />
                            {isSecure && <Lock className="absolute -bottom-0.5 -right-0.5 size-2.5 text-yellow-500" />}
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>{isSecure ? "Connected with SSL" : "Connected without SSL"}</TooltipContent>
                </Tooltip>
            )
        case WebSocketState._2:
            return (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <WifiOff className="size-5 text-destructive" />
                    </TooltipTrigger>
                    <TooltipContent>Disconnected</TooltipContent>
                </Tooltip>
            )
    }
}
export default ClientConnectionStatus
