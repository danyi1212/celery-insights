import { useEffect } from "react"
import useSettingsStore, { PreferredTheme } from "@stores/useSettingsStore"

export const useDarkMode = () => {
    const settingsTheme = useSettingsStore((state) => state.theme)

    useEffect(() => {
        const mql = window.matchMedia("(prefers-color-scheme: dark)")

        const apply = () => {
            const isDark =
                settingsTheme === PreferredTheme.DARK || (settingsTheme === PreferredTheme.SYSTEM && mql.matches)
            document.documentElement.classList.toggle("dark", isDark)
        }

        apply()
        mql.addEventListener("change", apply)
        return () => mql.removeEventListener("change", apply)
    }, [settingsTheme])
}
