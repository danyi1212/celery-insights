import SignalWifi1BarIcon from "@mui/icons-material/SignalWifi1Bar"
import SignalWifi1BarLockIcon from "@mui/icons-material/SignalWifi1BarLock"
import SignalWifi4BarIcon from "@mui/icons-material/SignalWifi4Bar"
import SignalWifi4BarLockIcon from "@mui/icons-material/SignalWifi4BarLock"
import SignalWifiBadIcon from "@mui/icons-material/SignalWifiBad"
import Tooltip from "@mui/material/Tooltip"
import { WebSocketState } from "@services/server"
import React from "react"

interface ClientConnectionStatusProps {
    state: WebSocketState
    isSecure: boolean
}

const ClientConnectionStatus: React.FC<ClientConnectionStatusProps> = ({ state, isSecure }) => {
    switch (state) {
        case WebSocketState._0:
            if (isSecure) {
                return (
                    <Tooltip title="Connecting with SSL">
                        <SignalWifi1BarLockIcon color="info" />
                    </Tooltip>
                )
            } else {
                return (
                    <Tooltip title="Connecting without SSL">
                        <SignalWifi1BarIcon color="warning" />
                    </Tooltip>
                )
            }
        case WebSocketState._1:
            if (isSecure) {
                return (
                    <Tooltip title="Connected with SSL">
                        <SignalWifi4BarLockIcon color="warning" />
                    </Tooltip>
                )
            } else {
                return (
                    <Tooltip title="Connected without SSL">
                        <SignalWifi4BarIcon color="warning" />
                    </Tooltip>
                )
            }
        case WebSocketState._2:
            return (
                <Tooltip title="Disconnected">
                    <SignalWifiBadIcon color="error" />
                </Tooltip>
            )
    }
}
export default ClientConnectionStatus
