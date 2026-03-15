import {
  HotkeysProvider,
  formatHotkey,
  rawHotkeyToParsedHotkey,
  useHotkey,
  useHotkeySequence,
  type Hotkey,
  type RawHotkey,
} from "@tanstack/react-hotkeys"
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from "react"

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

const normalizedKeyMap: Record<string, string> = {
  " ": "Space",
  arrowdown: "ArrowDown",
  arrowleft: "ArrowLeft",
  arrowright: "ArrowRight",
  arrowup: "ArrowUp",
  backspace: "Backspace",
  delete: "Delete",
  enter: "Enter",
  escape: "Escape",
  esc: "Escape",
  space: "Space",
  tab: "Tab",
}

const toHotkey = (trigger: ShortcutTrigger): RawHotkey => ({
  alt: trigger.alt,
  key: normalizedKeyMap[trigger.key.toLowerCase()] ?? trigger.key.toUpperCase(),
  mod: trigger.mod,
  shift: trigger.shift,
})

const toSequenceHotkey = (trigger: ShortcutTrigger): Hotkey =>
  formatHotkey(rawHotkeyToParsedHotkey(toHotkey(trigger))) as Hotkey

const getHotkeyOptions = (shortcut: RegisteredShortcut) => ({
  enabled: shortcut.enabled !== false,
  ignoreInputs: !shortcut.allowInInput,
  preventDefault: shortcut.preventDefault !== false,
  requireReset: true,
  stopPropagation: false,
})

const ShortcutHotkeyBinding = ({ shortcut }: { shortcut: RegisteredShortcut }) => {
  useHotkey(toHotkey(shortcut.sequence[0]!), shortcut.handler, getHotkeyOptions(shortcut))
  return null
}

const ShortcutSequenceBinding = ({ shortcut }: { shortcut: RegisteredShortcut }) => {
  useHotkeySequence(shortcut.sequence.map(toSequenceHotkey), shortcut.handler, {
    ...getHotkeyOptions(shortcut),
    timeout: SEQUENCE_TIMEOUT_MS,
  })

  return null
}

const KeyboardShortcutBindings = ({ shortcuts }: { shortcuts: RegisteredShortcut[] }) => {
  return shortcuts.map((shortcut) =>
    shortcut.sequence.length === 1 ? (
      <ShortcutHotkeyBinding key={`${shortcut.registrationId}:${shortcut.id}`} shortcut={shortcut} />
    ) : (
      <ShortcutSequenceBinding key={`${shortcut.registrationId}:${shortcut.id}`} shortcut={shortcut} />
    ),
  )
}

export const KeyboardShortcutsProvider = ({ children }: { children: ReactNode }) => {
  const [shortcutsByRegistration, setShortcutsByRegistration] = useState<Record<string, ShortcutDefinition[]>>({})
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false)

  const shortcuts = useMemo<RegisteredShortcut[]>(
    () =>
      Object.entries(shortcutsByRegistration).flatMap(([registrationId, registeredShortcuts]) =>
        registeredShortcuts.map((shortcut) => ({ ...shortcut, registrationId })),
      ),
    [shortcutsByRegistration],
  )

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
    [closeShortcutsDialog, openShortcutsDialog, registerShortcuts, shortcuts, shortcutsDialogOpen, unregisterShortcuts],
  )

  return (
    <HotkeysProvider
      defaultOptions={{
        hotkey: {
          stopPropagation: false,
        },
        hotkeySequence: {
          stopPropagation: false,
          timeout: SEQUENCE_TIMEOUT_MS,
        },
      }}
    >
      <KeyboardShortcutsContext.Provider value={value}>
        <KeyboardShortcutBindings shortcuts={shortcuts} />
        {children}
      </KeyboardShortcutsContext.Provider>
    </HotkeysProvider>
  )
}

export const useKeyboardShortcuts = (shortcuts: ShortcutDefinition[]) => {
  const context = useContext(KeyboardShortcutsContext)
  const registrationId = useId()

  if (!context) {
    throw new Error("useKeyboardShortcuts must be used within a KeyboardShortcutsProvider")
  }

  const { registerShortcuts, unregisterShortcuts } = context

  useEffect(() => {
    registerShortcuts(registrationId, shortcuts)
    return () => unregisterShortcuts(registrationId)
  }, [registerShortcuts, unregisterShortcuts, registrationId, shortcuts])
}

export const useKeyboardShortcutsContext = () => {
  const context = useContext(KeyboardShortcutsContext)

  if (!context) {
    throw new Error("useKeyboardShortcutsContext must be used within a KeyboardShortcutsProvider")
  }

  return context
}
