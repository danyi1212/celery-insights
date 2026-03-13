import { render, screen } from "@test-utils"
import userEvent from "@testing-library/user-event"
import useSettingsStore, { PreferredTheme, resetSettings } from "@stores/use-settings-store"
import SettingsPanel, { SettingsPanelAction } from "./settings-panel"

describe("SettingsPanel", () => {
    beforeEach(() => {
        localStorage.clear()
        resetSettings()
    })

    it("renders the workspace controls", () => {
        render(<SettingsPanel />)

        expect(screen.getByText("Workspace")).toBeInTheDocument()
        expect(screen.getByText("Theme")).toBeInTheDocument()
        expect(screen.getByText("Welcome banner")).toBeInTheDocument()
        expect(screen.getByText("Demo mode")).toBeInTheDocument()
        expect(screen.getByText("Live events limit")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /start tour/i })).toBeInTheDocument()
    })

    it("updates the welcome banner preference", async () => {
        const user = userEvent.setup()
        render(<SettingsPanel />)

        await user.click(screen.getByRole("switch", { name: /show welcome banner/i }))

        expect(useSettingsStore.getState().hideWelcomeBanner).toBe(true)
    })

    it("resets browser defaults", async () => {
        const user = userEvent.setup()
        useSettingsStore.setState({
            theme: PreferredTheme.DARK,
            hideWelcomeBanner: true,
            rawEventsLimit: 300,
        })

        render(
            <>
                <SettingsPanelAction />
                <SettingsPanel />
            </>,
        )
        await user.click(screen.getByRole("button", { name: /reset local settings/i }))

        const state = useSettingsStore.getState()
        expect(state.theme).toBe(PreferredTheme.SYSTEM)
        expect(state.hideWelcomeBanner).toBe(false)
        expect(state.rawEventsLimit).toBe(100)
    })
})
