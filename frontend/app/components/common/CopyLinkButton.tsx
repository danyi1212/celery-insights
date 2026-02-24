import CancelIcon from "@mui/icons-material/Cancel"
import CheckCircleIcon from "@mui/icons-material/CheckCircle"
import LinkIcon from "@mui/icons-material/Link"
import IconButton, { IconButtonProps } from "@mui/material/IconButton"
import Tooltip from "@mui/material/Tooltip"
import React, { useMemo, useState } from "react"

enum IconStatus {
    Default,
    Copied,
    Error,
}

const icons: Record<IconStatus, { icon: React.ReactNode; tooltip: string }> = {
    [IconStatus.Default]: {
        icon: <LinkIcon color="disabled" />,
        tooltip: "Copy link",
    },
    [IconStatus.Copied]: {
        icon: <CheckCircleIcon color="success" />,
        tooltip: "Copied!",
    },
    [IconStatus.Error]: {
        icon: <CancelIcon color="error" />,
        tooltip: "Error: could not copy",
    },
}

const CopyLinkButton: React.FC<IconButtonProps> = (props) => {
    const [status, setStatus] = useState<IconStatus>(IconStatus.Default)

    const copyCurrentLocation = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href)
            setStatus(IconStatus.Copied)

            setTimeout(() => {
                setStatus(IconStatus.Default)
            }, 5000)
        } catch (error) {
            console.error("Failed to copy the link:", error)
            setStatus(IconStatus.Error)
            setTimeout(() => {
                setStatus(IconStatus.Default)
            }, 5000)
        }
    }

    const icon = useMemo(() => icons[status], [status])
    return (
        <Tooltip title={icon.tooltip}>
            <IconButton onClick={copyCurrentLocation} {...props}>
                {icon.icon}
            </IconButton>
        </Tooltip>
    )
}

export default CopyLinkButton
