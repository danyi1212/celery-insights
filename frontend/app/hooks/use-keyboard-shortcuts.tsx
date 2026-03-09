import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react"

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
    closeShortcutsDialog: () => void
    openShortcutsDialog: () => void
    registerShortcuts: (registrationId: string, shortcuts: ShortcutDefinition[]) => void
    shortcuts: RegisteredShortcut[]
    shortcutsDialogOpen: boolean
    unregisterShortcuts: (registrationId: string) => void
}

const SEQUENCE_TIMEOUT_MS = 1200

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | null>(null)

const normalizeKey = (key: string) => (key === " " ? "space" : key.toLowerCase())

const isEditableTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
        return false
    }

    if (target.isContentEditable) {
        return true
    }

    return ["input", "select", "textarea"].includes(target.tagName.toLowerCase())
}

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

export const KeyboardShortcutsProvider = ({ children }: { children: ReactNode }) => {
    const [shortcutsByRegistration, setShortcutsByRegistration] = useState<Record<string, ShortcutDefinition[]>>({})
    const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false)
    const pendingSequenceRef = useRef<{ expiresAt: number; ids: string[]; index: number } | null>(null)

    const shortcuts = useMemo<RegisteredShortcut[]>(
        () =>
            Object.entries(shortcutsByRegistration).flatMap(([registrationId, registeredShortcuts]) =>
                registeredShortcuts.map((shortcut) => ({ ...shortcut, registrationId })),
            ),
        [shortcutsByRegistration],
    )

    const shortcutsRef = useRef(shortcuts)
    shortcutsRef.current = shortcuts

    useEffect(() => {
        const runShortcut = (event: KeyboardEvent, shortcut: RegisteredShortcut) => {
            if (shortcut.preventDefault !== false) {
                event.preventDefault()
            }

            pendingSequenceRef.current = null
            shortcut.handler()
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.repeat) {
                return
            }

            const editable = isEditableTarget(event.target)
            const availableShortcuts = shortcutsRef.current.filter(
                (shortcut) => shortcut.enabled !== false && (!editable || shortcut.allowInInput),
            )
            const now = Date.now()
            const pendingSequence = pendingSequenceRef.current

            if (pendingSequence && pendingSequence.expiresAt > now) {
                const matchedPendingShortcuts = availableShortcuts
                    .filter((shortcut) => pendingSequence.ids.includes(`${shortcut.registrationId}:${shortcut.id}`))
                    .filter((shortcut) => matchesTrigger(event, shortcut.sequence[pendingSequence.index]))

                if (matchedPendingShortcuts.length > 0) {
                    const completedShortcut = matchedPendingShortcuts.find(
                        (shortcut) => pendingSequence.index === shortcut.sequence.length - 1,
                    )

                    if (completedShortcut) {
                        runShortcut(event, completedShortcut)
                        return
                    }

                    pendingSequenceRef.current = {
                        expiresAt: now + SEQUENCE_TIMEOUT_MS,
                        ids: matchedPendingShortcuts.map((shortcut) => `${shortcut.registrationId}:${shortcut.id}`),
                        index: pendingSequence.index + 1,
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
                runShortcut(event, singleStepShortcut)
                return
            }

            const sequenceStarters = availableShortcuts.filter(
                (shortcut) => shortcut.sequence.length > 1 && matchesTrigger(event, shortcut.sequence[0]),
            )

            if (sequenceStarters.length === 0) {
                return
            }

            pendingSequenceRef.current = {
                expiresAt: now + SEQUENCE_TIMEOUT_MS,
                ids: sequenceStarters.map((shortcut) => `${shortcut.registrationId}:${shortcut.id}`),
                index: 1,
            }

            if (sequenceStarters.some((shortcut) => shortcut.preventDefault !== false)) {
                event.preventDefault()
            }
        }

        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [])

    const openShortcutsDialog = useCallback(() => setShortcutsDialogOpen(true), [])
    const closeShortcutsDialog = useCallback(() => setShortcutsDialogOpen(false), [])

    const registerShortcuts = useCallback((registrationId: string, registeredShortcuts: ShortcutDefinition[]) => {
        setShortcutsByRegistration((current) => {
            if (current[registrationId] === registeredShortcuts) {
                return current
            }

            return {
                ...current,
                [registrationId]: registeredShortcuts,
            }
        })
    }, [])

    const unregisterShortcuts = useCallback((registrationId: string) => {
        setShortcutsByRegistration((current) => {
            if (!(registrationId in current)) {
                return current
            }

            const next = { ...current }
            delete next[registrationId]
            return next
        })
    }, [])

    const value = useMemo<KeyboardShortcutsContextValue>(
        () => ({
            closeShortcutsDialog,
            openShortcutsDialog,
            registerShortcuts,
            shortcuts,
            shortcutsDialogOpen,
            unregisterShortcuts,
        }),
        [
            closeShortcutsDialog,
            openShortcutsDialog,
            registerShortcuts,
            shortcuts,
            shortcutsDialogOpen,
            unregisterShortcuts,
        ],
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
