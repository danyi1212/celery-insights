import { renderHook } from "@testing-library/react"
import useSettingsStore, { PreferredTheme, resetSettings, useIsDefaultSettings } from "./use-settings-store"

beforeEach(() => {
    localStorage.clear()
    resetSettings()
})

describe("useSettingsStore", () => {
    it("has correct default values", () => {
        const state = useSettingsStore.getState()

        expect(state.theme).toBe(PreferredTheme.SYSTEM)
        expect(state.hideWelcomeBanner).toBe(false)
        expect(state.rawEventsLimit).toBe(100)
    })

    it("resetSettings restores defaults after modification", () => {
        useSettingsStore.setState({ theme: PreferredTheme.DARK, hideWelcomeBanner: true })

        resetSettings()

        const state = useSettingsStore.getState()
        expect(state.theme).toBe(PreferredTheme.SYSTEM)
        expect(state.hideWelcomeBanner).toBe(false)
    })
})

describe("useIsDefaultSettings", () => {
    it("returns true when settings match defaults", () => {
        const { result } = renderHook(() => useIsDefaultSettings())
        expect(result.current).toBe(true)
    })

    it("returns false when settings differ from defaults", () => {
        useSettingsStore.setState({ theme: PreferredTheme.DARK })

        const { result } = renderHook(() => useIsDefaultSettings())
        expect(result.current).toBe(false)
    })
})
