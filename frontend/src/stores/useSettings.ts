import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export enum PreferredTheme {
    LIGHT = "light",
    DARK = "dark",
    SYSTEM = "system",
}

interface Settings {
    theme: PreferredTheme
}

const useSettingsStore = create<Settings>()(
    persist(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        (set) => ({
            theme: PreferredTheme.SYSTEM,
        }),
        {
            name: "settings",
            storage: createJSONStorage(() => localStorage),
        }
    )
)

export default useSettingsStore
