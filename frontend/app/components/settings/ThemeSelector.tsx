import Brightness2Icon from "@mui/icons-material/Brightness2"
import BrightnessAutoIcon from "@mui/icons-material/BrightnessAuto"
import BrightnessHighIcon from "@mui/icons-material/BrightnessHigh"
import ToggleButton from "@mui/material/ToggleButton"
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import Tooltip from "@mui/material/Tooltip"
import useSettingsStore, { PreferredTheme } from "@stores/useSettingsStore"
import React from "react"

const meta = [
    {
        theme: PreferredTheme.SYSTEM,
        icon: <BrightnessAutoIcon />,
        tooltip: "System Default",
    },
    {
        theme: PreferredTheme.DARK,
        icon: <Brightness2Icon />,
        tooltip: "Dark Theme",
    },
    {
        theme: PreferredTheme.LIGHT,
        icon: <BrightnessHighIcon />,
        tooltip: "Light Theme",
    },
]
const ThemeSelector: React.FC = () => {
    const theme = useSettingsStore((state) => state.theme)
    return (
        <ToggleButtonGroup
            exclusive
            value={theme}
            onChange={(event, newValue: PreferredTheme | undefined) =>
                newValue && useSettingsStore.setState({ theme: newValue })
            }
            aria-label="Theme"
        >
            {meta.map((item, index) => (
                <ToggleButton key={index} value={item.theme} aria-label={item.tooltip}>
                    <Tooltip title={item.tooltip}>{item.icon}</Tooltip>
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    )
}

export default ThemeSelector
