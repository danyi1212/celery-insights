import React, { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from "react"

export interface ShortcutTrigger {
    key: string
    alt?: boolean
    mod?: boolean
    shift?: boolean
}

export interface ShortcutDefinition {
    id: string
    description: string
    sequence: ShortcutTrigger[]
    handler: () => void
    section?: string
    allowInInput?: boolean
    preventDefault?: boolean
    enabled?: boolean
}

interface RegisteredShortcut extends ShortcutDefinition {
    registrationId: string
}

interface KeyboardShortcutsContextValue {
    openShortcutsDialog: () => void
    closeShortcutsDialog: () => void
    shortcutsDialogOpen: boolean
    registerShortcuts: (registrationId: string, shortcuts: ShortcutDefinition[]) => void
    unregisterShortcuts: (registrationId: string) => void
    shortcuts: RegisteredShortcut[]
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | null>(null)

const normalizeKey = (key: string) => (key === " " ? "space" : key.toLowerCase())

const matchesTrigger = (event: KeyboardEvent, trigger: ShortcutTrigger) => {
    const wantsMod = Boolean(trigger.mod)
    const modPressed = event.metaKey || event.ctrlKey

    return (
        normalizeKey(event.key) === normalizeKey(trigger.key) &&
        modPressed === wantsMod &&
        event.altKey === Boolean(trigger.alt) &&
        event.shiftKey === Boolean(trigger.shift)
    )
}

const isEditableTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false
    if (target.isContentEditable) return true

    const tagName = target.tagName.toLowerCase()
    return tagName === "input" || tagName === "textarea" || tagName === "select"
}

const SEQUENCE_TIMEOUT_MS = 1200

export const KeyboardShortcutsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [shortcutsByRegistration, setShortcutsByRegistration] = useState<Record<string, ShortcutDefinition[]>>({})
    const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false)
    const shortcuts = useMemo(
        () =>
            Object.entries(shortcutsByRegistration).flatMap(([registrationId, registeredShortcuts]) =>
                registeredShortcuts.map((shortcut) => ({ ...shortcut, registrationId })),
            ),
        [shortcutsByRegistration],
    )
    const shortcutsRef = useRef(shortcuts)
    const pendingSequenceRef = useRef<{ ids: string[]; index: number; expiresAt: number } | null>(null)

    shortcutsRef.current = shortcuts

    useEffect(() => {
        const listener = (event: KeyboardEvent) => {
            const editable = isEditableTarget(event.target)
            const availableShortcuts = shortcutsRef.current.filter(
                (shortcut) => shortcut.enabled !== false && (!editable || shortcut.allowInInput),
            )
            const now = Date.now()
            const runShortcut = (shortcut: RegisteredShortcut) => {
                if (shortcut.preventDefault !== false) {
                    event.preventDefault()
                }
                pendingSequenceRef.current = null
                shortcut.handler()
            }

            const pendingSequence = pendingSequenceRef.current
            if (pendingSequence && pendingSequence.expiresAt > now) {
                const pendingShortcuts = availableShortcuts.filter((shortcut) =>
                    pendingSequence.ids.includes(`${shortcut.registrationId}:${shortcut.id}`),
                )
                const matchedPendingShortcuts = pendingShortcuts.filter((shortcut) =>
                    matchesTrigger(event, shortcut.sequence[pendingSequence.index]),
                )

                if (matchedPendingShortcuts.length > 0) {
                    const completedShortcut = matchedPendingShortcuts.find(
                        (shortcut) => pendingSequence.index === shortcut.sequence.length - 1,
                    )

                    if (completedShortcut) {
                        runShortcut(completedShortcut)
                        return
                    }

                    pendingSequenceRef.current = {
                        ids: matchedPendingShortcuts.map((shortcut) => `${shortcut.registrationId}:${shortcut.id}`),
                        index: pendingSequence.index + 1,
                        expiresAt: now + SEQUENCE_TIMEOUT_MS,
                    }
                    if (matchedPendingShortcuts.some((shortcut) => shortcut.preventDefault !== false)) {
                        event.preventDefault()
                    }
                    return
                }

                pendingSequenceRef.current = null
            }

            const singleStepShortcut = availableShortcuts.find(
                (shortcut) => shortcut.sequence.length === 1 && matchesTrigger(event, shortcut.sequence[0]),
            )
            if (singleStepShortcut) {
                runShortcut(singleStepShortcut)
                return
            }

            const sequenceStarters = availableShortcuts.filter(
                (shortcut) => shortcut.sequence.length > 1 && matchesTrigger(event, shortcut.sequence[0]),
            )
            if (sequenceStarters.length > 0) {
                pendingSequenceRef.current = {
                    ids: sequenceStarters.map((shortcut) => `${shortcut.registrationId}:${shortcut.id}`),
                    index: 1,
                    expiresAt: now + SEQUENCE_TIMEOUT_MS,
                }
                if (sequenceStarters.some((shortcut) => shortcut.preventDefault !== false)) {
                    event.preventDefault()
                }
            }
        }

        window.addEventListener("keydown", listener)
        return () => window.removeEventListener("keydown", listener)
    }, [])

    const value = useMemo<KeyboardShortcutsContextValue>(
        () => ({
            openShortcutsDialog: () => setShortcutsDialogOpen(true),
            closeShortcutsDialog: () => setShortcutsDialogOpen(false),
            shortcutsDialogOpen,
            registerShortcuts: (registrationId, registeredShortcuts) =>
                setShortcutsByRegistration((current) => ({
                    ...current,
                    [registrationId]: registeredShortcuts,
                })),
            unregisterShortcuts: (registrationId) =>
                setShortcutsByRegistration((current) => {
                    const next = { ...current }
                    delete next[registrationId]
                    return next
                }),
            shortcuts,
        }),
        [shortcuts, shortcutsDialogOpen],
    )

    return <KeyboardShortcutsContext.Provider value={value}>{children}</KeyboardShortcutsContext.Provider>
}

export const useKeyboardShortcuts = (shortcuts: ShortcutDefinition[]) => {
    const context = useContext(KeyboardShortcutsContext)
    const registrationId = useId()
    const shortcutsRef = useRef(shortcuts)
    shortcutsRef.current = shortcuts

    useEffect(() => {
        if (!context) {
            throw new Error("useKeyboardShortcuts must be used within a KeyboardShortcutsProvider")
        }

        context.registerShortcuts(registrationId, shortcutsRef.current)
        return () => context.unregisterShortcuts(registrationId)
    }, [context, registrationId, shortcuts])
}

export const useKeyboardShortcutsContext = () => {
    const context = useContext(KeyboardShortcutsContext)
    if (!context) {
        throw new Error("useKeyboardShortcutsContext must be used within a KeyboardShortcutsProvider")
    }
    return context
}
