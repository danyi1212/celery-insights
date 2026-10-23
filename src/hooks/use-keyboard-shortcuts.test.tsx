import { fireEvent, render, screen, waitFor } from "@test-utils"
import { useMemo } from "react"
import {
  KeyboardShortcutsProvider,
  useKeyboardShortcuts,
  useKeyboardShortcutsContext,
  type ShortcutDefinition,
} from "./use-keyboard-shortcuts"

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

const ShortcutBindings = ({ shortcuts }: { shortcuts: ShortcutDefinition[] }) => {
  useKeyboardShortcuts(shortcuts)
  return <input aria-label="Task search" />
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

  it("fires a chord once until its keys are released", () => {
    const handler = vi.fn()
    render(
      <KeyboardShortcutsProvider>
        <ShortcutBindings
          shortcuts={[{ id: "search", description: "Search", sequence: [{ key: "k", shift: true }], handler }]}
        />
      </KeyboardShortcutsProvider>,
    )

    fireEvent.keyDown(document, { key: "k", code: "KeyK", shiftKey: true })
    fireEvent.keyDown(document, { key: "k", code: "KeyK", shiftKey: true, repeat: true })
    expect(handler).toHaveBeenCalledTimes(1)

    fireEvent.keyUp(document, { key: "k", code: "KeyK", shiftKey: true })
    fireEvent.keyUp(document, { key: "Shift" })
    fireEvent.keyDown(document, { key: "k", code: "KeyK", shiftKey: true })
    expect(handler).toHaveBeenCalledTimes(2)
    fireEvent.keyUp(document, { key: "k", code: "KeyK" })
    fireEvent.keyUp(document, { key: "Shift" })
  })

  it("matches sequences in order and ignores typing in inputs", () => {
    const handler = vi.fn()
    render(
      <KeyboardShortcutsProvider>
        <ShortcutBindings
          shortcuts={[{ id: "tasks", description: "Tasks", sequence: [{ key: "g" }, { key: "t" }], handler }]}
        />
      </KeyboardShortcutsProvider>,
    )

    const pressKey = (target: HTMLElement | Document, key: string) => {
      fireEvent.keyDown(target, { key })
      fireEvent.keyUp(target, { key })
    }
    pressKey(document, "t")
    expect(handler).not.toHaveBeenCalled()
    pressKey(document, "g")
    expect(handler).not.toHaveBeenCalled()
    pressKey(document, "t")
    expect(handler).toHaveBeenCalledTimes(1)

    const input = screen.getByRole("textbox", { name: "Task search" })
    input.focus()
    pressKey(input, "g")
    pressKey(input, "t")
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
