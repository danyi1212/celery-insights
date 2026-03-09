import { appShortcuts } from "@components/keyboard/shortcut-definitions"
import { ShortcutHint } from "@components/keyboard/shortcut-hint"
import { Button } from "@components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useKeyboardShortcutsContext } from "@hooks/use-keyboard-shortcuts"
import { Keyboard } from "lucide-react"

export const KeyboardShortcutsButton = () => {
    const { openShortcutsDialog } = useKeyboardShortcutsContext()

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={openShortcutsDialog} aria-label="Keyboard shortcuts">
                    <Keyboard className="size-5" />
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                <div className="flex items-center gap-2">
                    <span>Keyboard shortcuts</span>
                    <ShortcutHint sequence={appShortcuts.openHelp} />
                </div>
            </TooltipContent>
        </Tooltip>
    )
}
