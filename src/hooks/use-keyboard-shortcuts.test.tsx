import { render, screen, waitFor } from "@test-utils"
import { useMemo } from "react"
import {
  KeyboardShortcutsProvider,
  useKeyboardShortcuts,
  useKeyboardShortcutsContext,
  type ShortcutDefinition,
} from "./use-keyboard-shortcuts"

vi.mock("@tanstack/react-hotkeys", () => ({
  HotkeysProvider: ({ children }: { children: React.ReactNode }) => children,
  formatHotkey: (hotkey: unknown) => hotkey,
  rawHotkeyToParsedHotkey: (hotkey: unknown) => hotkey,
  useHotkey: vi.fn(),
  useHotkeySequence: vi.fn(),
}))

const ShortcutConsumer = () => {
  const shortcuts = useMemo<ShortcutDefinition[]>(
    () => [
      {
        id: "open-search",
        description: "Open quick search",
        handler: vi.fn(),
        sequence: [{ key: "k", mod: true }],
      },
    ],
    [],
  )

  useKeyboardShortcuts(shortcuts)
  const { shortcuts: registeredShortcuts } = useKeyboardShortcutsContext()

  return <div data-testid="shortcut-count">{registeredShortcuts.length}</div>
}

describe("useKeyboardShortcuts", () => {
  it("registers shortcuts without looping on context updates", async () => {
    render(
      <KeyboardShortcutsProvider>
        <ShortcutConsumer />
      </KeyboardShortcutsProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("shortcut-count")).toHaveTextContent("1")
    })
  })
})
