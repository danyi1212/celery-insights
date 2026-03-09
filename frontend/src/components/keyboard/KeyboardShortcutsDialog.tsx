import ShortcutHint from "@components/keyboard/ShortcutHint"
import { useKeyboardShortcutsContext } from "@hooks/useKeyboardShortcuts"
import Button from "@mui/material/Button"
import Dialog from "@mui/material/Dialog"
import DialogActions from "@mui/material/DialogActions"
import DialogContent from "@mui/material/DialogContent"
import DialogTitle from "@mui/material/DialogTitle"
import Divider from "@mui/material/Divider"
import Stack from "@mui/material/Stack"
import Typography from "@mui/material/Typography"
import React, { useMemo } from "react"

const KeyboardShortcutsDialog: React.FC = () => {
    const { closeShortcutsDialog, shortcuts, shortcutsDialogOpen } = useKeyboardShortcutsContext()
    const sections = useMemo(() => {
        const grouped = new Map<string, typeof shortcuts>()

        shortcuts.forEach((shortcut) => {
            if (shortcut.enabled === false) return
            const section = shortcut.section ?? "General"
            const existing = grouped.get(section) ?? []
            if (!existing.some((registeredShortcut) => registeredShortcut.id === shortcut.id)) {
                grouped.set(section, [...existing, shortcut])
            }
        })

        return [...grouped.entries()]
    }, [shortcuts])

    return (
        <Dialog open={shortcutsDialogOpen} onClose={closeShortcutsDialog} fullWidth maxWidth="sm">
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2.5}>
                    {sections.map(([section, sectionShortcuts]) => (
                        <Stack key={section} spacing={1.5}>
                            <Typography variant="overline" color="text.secondary">
                                {section}
                            </Typography>
                            <Stack spacing={1.5}>
                                {sectionShortcuts.map((shortcut) => (
                                    <Stack
                                        key={`${shortcut.registrationId}:${shortcut.id}`}
                                        direction="row"
                                        alignItems="center"
                                        justifyContent="space-between"
                                        spacing={2}
                                    >
                                        <Typography variant="body2">{shortcut.description}</Typography>
                                        <ShortcutHint sequence={shortcut.sequence} />
                                    </Stack>
                                ))}
                            </Stack>
                            <Divider />
                        </Stack>
                    ))}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={closeShortcutsDialog}>Close</Button>
            </DialogActions>
        </Dialog>
    )
}

export default KeyboardShortcutsDialog
