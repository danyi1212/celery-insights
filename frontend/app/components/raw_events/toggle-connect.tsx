import { appShortcuts } from "@components/keyboard/shortcut-definitions"
import { ShortcutHint } from "@components/keyboard/shortcut-hint"
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
    const label = connect ? "Freeze live events" : "Connect live events"

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setConnect(!connect)}
                    disabled={disabled}
                    aria-label={label}
                >
                    {connect ? <Pause className="size-4" /> : <Play className="size-4" />}
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                <div className="flex items-center gap-2">
                    <span>{connect ? "Freeze" : "Connect"}</span>
                    {!disabled ? <ShortcutHint sequence={appShortcuts.toggleLiveEventsConnection} /> : null}
                </div>
            </TooltipContent>
        </Tooltip>
    )
}
