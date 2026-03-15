import { ShortcutHint } from "@components/keyboard/shortcut-hint"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog"
import { useKeyboardShortcutsContext } from "@hooks/use-keyboard-shortcuts"
import { useMemo } from "react"

export const KeyboardShortcutsDialog = () => {
  const { closeShortcutsDialog, shortcuts, shortcutsDialogOpen } = useKeyboardShortcutsContext()

  const sections = useMemo(() => {
    const grouped = new Map<string, typeof shortcuts>()

    for (const shortcut of shortcuts) {
      if (shortcut.enabled === false) {
        continue
      }

      const section = shortcut.section ?? "General"
      const sectionShortcuts = grouped.get(section) ?? []

      if (!sectionShortcuts.some((registeredShortcut) => registeredShortcut.id === shortcut.id)) {
        grouped.set(section, [...sectionShortcuts, shortcut])
      }
    }

    return [...grouped.entries()]
  }, [shortcuts])

  return (
    <Dialog open={shortcutsDialogOpen} onOpenChange={(open) => !open && closeShortcutsDialog()}>
      <DialogContent className="max-h-[min(36rem,calc(100vh-2rem))] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Available shortcuts update with the page, so route-specific controls appear when relevant.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto px-6 py-4">
          <div className="space-y-6">
            {sections.map(([section, sectionShortcuts]) => (
              <section key={section} className="space-y-3">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{section}</h3>
                <div className="space-y-2">
                  {sectionShortcuts.map((shortcut) => (
                    <div
                      key={`${shortcut.registrationId}:${shortcut.id}`}
                      className="flex items-center justify-between gap-4 rounded-md border px-3 py-2"
                    >
                      <span className="text-sm">{shortcut.description}</span>
                      <ShortcutHint className="shrink-0" sequence={shortcut.sequence} />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
        <DialogFooter className="border-t px-6 py-4" showCloseButton />
      </DialogContent>
    </Dialog>
  )
}
