import { appShortcuts } from "@components/keyboard/shortcut-definitions"
import { ShortcutHint } from "@components/keyboard/shortcut-hint"
import { Button } from "@components/ui/button"
import { Separator } from "@components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useKeyboardShortcuts } from "@hooks/use-keyboard-shortcuts"
import { ArrowLeft, ArrowRight } from "lucide-react"
import React, { useCallback, useMemo, useState } from "react"

interface ExplorerLayoutProps {
    facets?: React.ReactNode
    actions?: React.ReactNode
    children?: React.ReactNode
}

const FACET_WIDTH = 300
export const ExplorerLayout: React.FC<ExplorerLayoutProps> = ({ facets, actions, children }) => {
    const [isFacetMenuOpen, setFacetMenuOpen] = useState(true)
    const toggleFacets = useCallback(() => setFacetMenuOpen((open) => !open), [])
    const shortcuts = useMemo(
        () => [
            {
                description: "Toggle facets panel",
                handler: toggleFacets,
                id: "toggle-facets",
                section: "Current Page",
                sequence: appShortcuts.toggleFacets,
            },
        ],
        [toggleFacets],
    )

    useKeyboardShortcuts(shortcuts)

    return (
        <div className="flex flex-row">
            <div
                className="overflow-hidden transition-[width] duration-300"
                style={{ width: isFacetMenuOpen ? FACET_WIDTH : 0 }}
            >
                <div className="flex h-12 items-center px-4">
                    <h5 className="text-lg font-semibold">Facets</h5>
                </div>
                <Separator />
                {facets}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex h-12 items-center px-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={toggleFacets}>
                                {isFacetMenuOpen ? <ArrowLeft className="size-4" /> : <ArrowRight className="size-4" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <div className="flex items-center gap-2">
                                <span>{isFacetMenuOpen ? "Hide facets" : "Show facets"}</span>
                                <ShortcutHint sequence={appShortcuts.toggleFacets} />
                            </div>
                        </TooltipContent>
                    </Tooltip>
                    <div className="flex-1" />
                    <div className="flex items-center gap-2">{actions}</div>
                </div>
                {children}
            </div>
        </div>
    )
}
