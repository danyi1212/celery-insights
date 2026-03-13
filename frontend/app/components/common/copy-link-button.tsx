import { Button } from "@components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { CheckCircle2, Link, XCircle } from "lucide-react"
import React, { useMemo, useState } from "react"

enum IconStatus {
    Default,
    Copied,
    Error,
}

const icons: Record<IconStatus, { icon: React.ReactNode; tooltip: string }> = {
    [IconStatus.Default]: {
        icon: <Link className="size-4 text-muted-foreground" />,
        tooltip: "Copy link",
    },
    [IconStatus.Copied]: {
        icon: <CheckCircle2 className="size-4 text-status-success" />,
        tooltip: "Copied!",
    },
    [IconStatus.Error]: {
        icon: <XCircle className="size-4 text-status-danger" />,
        tooltip: "Error: could not copy",
    },
}

const CopyLinkButton: React.FC<React.ComponentProps<typeof Button>> = (props) => {
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
        <Tooltip>
            <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={copyCurrentLocation} {...props}>
                    {icon.icon}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{icon.tooltip}</TooltipContent>
        </Tooltip>
    )
}

export default CopyLinkButton
