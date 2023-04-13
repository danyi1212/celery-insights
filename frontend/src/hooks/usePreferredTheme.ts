import { Theme, useMediaQuery } from "@mui/material"
import useSettingsStore, { PreferredTheme } from "@stores/useSettings"
import { darkTheme, lightTheme } from "@theme"

export const usePreferredTheme = (): Theme => {
    const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)")
    const settingsTheme = useSettingsStore((state) => state.theme)
    const themeMode =
        settingsTheme == PreferredTheme.SYSTEM
            ? prefersDarkMode
                ? PreferredTheme.DARK
                : PreferredTheme.LIGHT
            : settingsTheme
    switch (themeMode) {
        case PreferredTheme.DARK:
            return darkTheme
        case PreferredTheme.LIGHT:
            return lightTheme
    }
}
