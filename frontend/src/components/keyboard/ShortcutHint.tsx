import Kbd from "@components/common/Kbd"
import Box from "@mui/material/Box"
import Stack from "@mui/material/Stack"
import Typography from "@mui/material/Typography"
import { ShortcutTrigger } from "@hooks/useKeyboardShortcuts"
import React from "react"

const isApplePlatform = () => typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.userAgent)

const formatTriggerTokens = (trigger: ShortcutTrigger) => {
    const tokens: string[] = []

    if (trigger.mod) {
        tokens.push(isApplePlatform() ? "Cmd" : "Ctrl")
    }
    if (trigger.alt) {
        tokens.push(isApplePlatform() ? "Opt" : "Alt")
    }
    if (trigger.shift && !/^[^a-z0-9]$/i.test(trigger.key)) {
        tokens.push("Shift")
    }

    const key = trigger.key.length === 1 ? trigger.key.toUpperCase() : trigger.key
    tokens.push(key === "space" ? "Space" : key)

    return tokens
}

interface ShortcutHintProps {
    sequence: ShortcutTrigger[]
}

const ShortcutHint: React.FC<ShortcutHintProps> = ({ sequence }) => {
    return (
        <Stack direction="row" spacing={0.75} alignItems="center">
            {sequence.map((trigger, index) => (
                <React.Fragment key={`${trigger.key}-${index}`}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                        {formatTriggerTokens(trigger).map((token) => (
                            <Kbd key={token}>{token}</Kbd>
                        ))}
                    </Stack>
                    {index < sequence.length - 1 ? (
                        <Typography variant="caption" color="text.secondary">
                            then
                        </Typography>
                    ) : null}
                </React.Fragment>
            ))}
        </Stack>
    )
}

interface ShortcutHintWithLabelProps extends ShortcutHintProps {
    label: React.ReactNode
}

export const ShortcutHintWithLabel: React.FC<ShortcutHintWithLabelProps> = ({ label, sequence }) => {
    return (
        <Box display="flex" alignItems="center" justifyContent="space-between" gap={1.5} width="100%">
            <Box sx={{ minWidth: 0 }}>{label}</Box>
            <ShortcutHint sequence={sequence} />
        </Box>
    )
}

export default ShortcutHint
