import { Button } from "@components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { Pause, Play } from "lucide-react"
import React from "react"

interface ToggleConnectProps {
    connect: boolean
    setConnect: (connect: boolean) => void
    disabled?: boolean
}

export const ToggleConnect: React.FC<ToggleConnectProps> = ({ connect, setConnect, disabled }) => {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setConnect(!connect)} disabled={disabled}>
                    {connect ? <Pause className="size-4" /> : <Play className="size-4" />}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{connect ? "Freeze" : "Connect"}</TooltipContent>
        </Tooltip>
    )
}
