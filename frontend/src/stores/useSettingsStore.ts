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
}

const defaultSettings = {
    theme: PreferredTheme.SYSTEM,
    menuExpanded: true,
    hideWelcomeBanner: false,
}
const useSettingsStore = create<Settings>()(
    persist(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        (set) => defaultSettings,
        {
            name: "settings",
            storage: createJSONStorage(() => localStorage),
        }
    )
)

export const resetSettings = () => useSettingsStore.setState(defaultSettings)

export default useSettingsStore
