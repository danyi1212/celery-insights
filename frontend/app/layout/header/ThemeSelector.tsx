import Brightness2Icon from "@mui/icons-material/Brightness2"
import BrightnessAutoIcon from "@mui/icons-material/BrightnessAuto"
import BrightnessHighIcon from "@mui/icons-material/BrightnessHigh"
import Collapse from "@mui/material/Collapse"
import IconButton from "@mui/material/IconButton"
import Tooltip from "@mui/material/Tooltip"
import useSettingsStore, { PreferredTheme } from "@stores/useSettingsStore"
import React, { useState } from "react"

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
    const [hovering, setHovering] = useState<boolean>(false)
    return (
        <>
            {meta.map((value) => (
                <Collapse key={value.theme} orientation="horizontal" in={hovering || value.theme === theme}>
                    <Tooltip title={value.tooltip} arrow>
                        <IconButton
                            onMouseEnter={() => setHovering(true)}
                            onMouseLeave={() => setHovering(false)}
                            onClick={() => useSettingsStore.setState({ theme: value.theme })}
                            sx={{ borderRadius: 0 }}
                        >
                            {value.icon}
                        </IconButton>
                    </Tooltip>
                </Collapse>
            ))}
        </>
    )
}
export default ThemeSelector
