import "@testing-library/jest-dom/vitest"

// happy-dom does not implement ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}
