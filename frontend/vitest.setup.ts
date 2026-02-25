import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

afterEach(() => {
    cleanup()
})

// jsdom does not implement ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}
