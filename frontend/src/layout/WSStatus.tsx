import ChangeCircleIcon from "@mui/icons-material/ChangeCircle"
import CheckCircleIcon from "@mui/icons-material/CheckCircle"
import ErrorIcon from "@mui/icons-material/Error"
import Slide from "@mui/material/Slide"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import { useStateStore } from "@stores/useStateStore"
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

const WSStatus: React.FC = () => {
    const status = useStateStore((store) => store.status)
    const meta = statusMeta[status]

    const [isOpen, setOpen] = useState(true)

    useEffect(() => {
        setOpen(true)
        const token = setTimeout(() => setOpen(false), 1000 * 5)
        return () => clearTimeout(token)
    }, [status])
    return (
        <>
            <div style={{ overflow: "hidden" }}>
                <Slide appear={false} direction="left" in={isOpen}>
                    <Typography p="10px">{meta.description}</Typography>
                </Slide>
            </div>
            <Tooltip title={meta.description}>{meta.icon}</Tooltip>
        </>
    )
}
export default WSStatus
