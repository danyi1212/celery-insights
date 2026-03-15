import type { ShortcutTrigger } from "@hooks/use-keyboard-shortcuts"

export const appShortcuts = {
  focusSearchAlt: [{ key: "/" }],
  openHelp: [{ key: "?", shift: true }],
  focusSearch: [{ key: "k", mod: true }],
  toggleFacets: [{ key: "f" }],
  toggleLiveEventsConnection: [{ key: "c" }],
  toggleSidebar: [{ key: "b", mod: true }],
} satisfies Record<string, ShortcutTrigger[]>
