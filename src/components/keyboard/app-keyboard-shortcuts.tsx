import { KeyboardShortcutsDialog } from "@components/keyboard/keyboard-shortcuts-dialog"
import { appShortcuts } from "@components/keyboard/shortcut-definitions"
import { useSearchBoxController } from "@components/search/search-box-controller"
import { useSidebar } from "@components/ui/sidebar"
import { useKeyboardShortcuts, useKeyboardShortcutsContext } from "@hooks/use-keyboard-shortcuts"
import { useMemo } from "react"

export const AppKeyboardShortcuts = () => {
  const { focusSearch } = useSearchBoxController()
  const { openShortcutsDialog } = useKeyboardShortcutsContext()
  const { toggleSidebar } = useSidebar()

  const shortcuts = useMemo(
    () => [
      {
        description: "Open quick search",
        handler: focusSearch,
        id: "focus-search",
        section: "Global",
        sequence: appShortcuts.focusSearch,
      },
      {
        description: "Open quick search with /",
        handler: focusSearch,
        id: "focus-search-alt",
        section: "Global",
        sequence: appShortcuts.focusSearchAlt,
      },
      {
        description: "Open keyboard shortcuts",
        handler: openShortcutsDialog,
        id: "open-help",
        section: "Global",
        sequence: appShortcuts.openHelp,
      },
      {
        description: "Toggle sidebar",
        handler: toggleSidebar,
        id: "toggle-sidebar",
        section: "Global",
        sequence: appShortcuts.toggleSidebar,
      },
    ],
    [focusSearch, openShortcutsDialog, toggleSidebar],
  )

  useKeyboardShortcuts(shortcuts)

  return <KeyboardShortcutsDialog />
}
