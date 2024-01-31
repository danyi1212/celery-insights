import ChangeCircleIcon from "@mui/icons-material/ChangeCircle"
import CheckCircleIcon from "@mui/icons-material/CheckCircle"
import ErrorIcon from "@mui/icons-material/Error"
import OfflineBoltIcon from "@mui/icons-material/OfflineBolt"
import Box from "@mui/material/Box"
import Slide from "@mui/material/Slide"
import Stack from "@mui/material/Stack"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import React, { useEffect, useState } from "react"
import { ReadyState } from "react-use-websocket"

interface Meta {
    description: string
    icon: React.ReactElement
}

const statusMeta: Record<ReadyState, Meta> = {
    [ReadyState.OPEN]: {
        description: "Connected",
        icon: <CheckCircleIcon color="success" />,
    },
    [ReadyState.CLOSED]: {
        description: "Disconnected",
        icon: <ErrorIcon color="error" />,
    },
    [ReadyState.CLOSING]: {
        description: "Disconnecting...",
        icon: <ChangeCircleIcon color="warning" />,
    },
    [ReadyState.CONNECTING]: {
        description: "Connecting...",
        icon: <ChangeCircleIcon color="warning" />,
    },
    [ReadyState.UNINSTANTIATED]: {
        description: "Starting...",
        icon: <ChangeCircleIcon color="warning" />,
    },
}

const demoMeta: Meta = {
    description: "Demo Mode",
    icon: <OfflineBoltIcon color="primary" />,
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
        <Stack direction="row" alignItems="center" p={1}>
            <Box overflow="hidden">
                <Slide appear={false} direction="left" in={isOpen}>
                    <Typography p="10px">{meta.description}</Typography>
                </Slide>
            </Box>
            <Tooltip title={meta.description}>{meta.icon}</Tooltip>
        </Stack>
    )
}
export default WsStateIcon
