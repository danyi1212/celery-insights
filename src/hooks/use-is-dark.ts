import useSettingsStore, { PreferredTheme } from "@stores/use-settings-store"
import { useMediaQuery } from "@hooks/use-media-query"

export const useIsDark = () => {
  const theme = useSettingsStore((state) => state.theme)
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)")
  return theme === PreferredTheme.DARK || (theme === PreferredTheme.SYSTEM && systemDark)
}
