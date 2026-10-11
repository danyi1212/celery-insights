import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export enum PreferredTheme {
  LIGHT = "light",
  DARK = "dark",
  SYSTEM = "system",
}

interface Settings {
  theme: PreferredTheme
  hideWelcomeBanner: boolean
  demo: boolean
  rawEventsLimit: number
}

const defaultSettings: Settings = {
  theme: PreferredTheme.SYSTEM,
  hideWelcomeBanner: false,
  demo: import.meta.env.DEV || Boolean(import.meta.env.VITE_DEMO_MODE),
  rawEventsLimit: 100,
}

export const useDeploymentSettings = create<{ demoAvailable: boolean }>(() => ({ demoAvailable: true }))

export function applyDeploymentDefaults(config: {
  demoAvailable?: boolean
  theme?: "light" | "dark" | "system"
  hideWelcomeBanner?: boolean
  rawEventsLimit?: number
}): void {
  const hasSavedPreferences = localStorage.getItem("settings") !== null
  if (config.theme)
    defaultSettings.theme = { light: PreferredTheme.LIGHT, dark: PreferredTheme.DARK, system: PreferredTheme.SYSTEM }[
      config.theme
    ]
  if (config.hideWelcomeBanner !== undefined) defaultSettings.hideWelcomeBanner = config.hideWelcomeBanner
  if (config.rawEventsLimit !== undefined) defaultSettings.rawEventsLimit = config.rawEventsLimit
  const demoAvailable = config.demoAvailable ?? true
  if (!demoAvailable) defaultSettings.demo = false
  useDeploymentSettings.setState({ demoAvailable })
  if (!hasSavedPreferences) useSettingsStore.setState({ ...defaultSettings })
  if (!demoAvailable) useSettingsStore.setState({ demo: false })
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
