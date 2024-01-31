import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export enum PreferredTheme {
    LIGHT = "light",
    DARK = "dark",
    SYSTEM = "system",
}

interface Settings {
    theme: PreferredTheme
    menuExpanded: boolean
    hideWelcomeBanner: boolean
    demo: boolean
    rawEventsLimit: number
}

const defaultSettings: Settings = {
    theme: PreferredTheme.SYSTEM,
    menuExpanded: true,
    hideWelcomeBanner: false,
    demo: Boolean(import.meta.env.VITE_DEMO_MODE),
    rawEventsLimit: 100,
}
const useSettingsStore = create<Settings>()(
    persist(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        (set) => defaultSettings,
        {
            name: "settings",
            storage: createJSONStorage(() => localStorage),
        },
    ),
)

export const resetSettings = () => useSettingsStore.setState(defaultSettings)
export const useIsDefaultSettings = () =>
    useSettingsStore((state) => JSON.stringify(state) === JSON.stringify(defaultSettings))

export default useSettingsStore
