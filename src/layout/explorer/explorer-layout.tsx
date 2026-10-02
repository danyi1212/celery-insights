import { appShortcuts } from "@components/keyboard/shortcut-definitions"
import { ShortcutHint } from "@components/keyboard/shortcut-hint"
import { Button } from "@components/ui/button"
import { Separator } from "@components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useKeyboardShortcuts } from "@hooks/use-keyboard-shortcuts"
import { ArrowLeft, ArrowRight } from "lucide-react"
import React, { useCallback, useMemo, useState } from "react"

interface ExplorerLayoutProps {
  filters?: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
}

const FACET_WIDTH = 300
export const ExplorerLayout: React.FC<ExplorerLayoutProps> = ({ filters, actions, children }) => {
  const [isFilterPanelOpen, setFilterPanelOpen] = useState(true)
  const toggleFilters = useCallback(() => setFilterPanelOpen((open) => !open), [])
  const shortcuts = useMemo(
    () => [
      {
        description: "Toggle filters panel",
        handler: toggleFilters,
        id: "toggle-filters",
        section: "Current Page",
        sequence: appShortcuts.toggleFilters,
      },
    ],
    [toggleFilters],
  )

  useKeyboardShortcuts(shortcuts)

  return (
    <div className="flex flex-row">
      <div
        className="overflow-hidden transition-[width] duration-300"
        style={{ width: isFilterPanelOpen ? FACET_WIDTH : 0 }}
      >
        <Separator />
        {filters}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex h-12 items-center px-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={toggleFilters}>
                {isFilterPanelOpen ? <ArrowLeft className="size-4" /> : <ArrowRight className="size-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="flex items-center gap-2">
                <span>{isFilterPanelOpen ? "Hide filters" : "Show filters"}</span>
                <ShortcutHint sequence={appShortcuts.toggleFilters} />
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
