import useSettingsStore, { PreferredTheme } from "@stores/useSettingsStore"
import { useMediaQuery } from "@hooks/useMediaQuery"

export const useIsDark = () => {
    const theme = useSettingsStore((state) => state.theme)
    const systemDark = useMediaQuery("(prefers-color-scheme: dark)")
    return theme === PreferredTheme.DARK || (theme === PreferredTheme.SYSTEM && systemDark)
}
