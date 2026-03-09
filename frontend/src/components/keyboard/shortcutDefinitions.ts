import { ShortcutTrigger } from "@hooks/useKeyboardShortcuts"

export const searchShortcut: ShortcutTrigger[] = [{ key: "/" }]
export const commandPaletteShortcut: ShortcutTrigger[] = [{ key: "k", mod: true }]
export const shortcutsHelpShortcut: ShortcutTrigger[] = [{ key: "?", shift: true }]
export const toggleMenuShortcut: ShortcutTrigger[] = [{ key: "m" }]
export const toggleFacetsShortcut: ShortcutTrigger[] = [{ key: "f" }]
export const toggleRawEventsConnectionShortcut: ShortcutTrigger[] = [{ key: "c" }]

export const dashboardShortcut: ShortcutTrigger[] = [{ key: "g" }, { key: "h" }]
export const explorerShortcut: ShortcutTrigger[] = [{ key: "g" }, { key: "e" }]
export const rawEventsShortcut: ShortcutTrigger[] = [{ key: "g" }, { key: "r" }]
export const settingsShortcut: ShortcutTrigger[] = [{ key: "g" }, { key: "s" }]
