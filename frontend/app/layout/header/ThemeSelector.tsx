import { Button } from "@components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { Monitor, Moon, Sun } from "lucide-react"
import useSettingsStore, { PreferredTheme } from "@stores/useSettingsStore"
import React, { useState } from "react"

const meta = [
    {
        theme: PreferredTheme.SYSTEM,
        icon: <Monitor className="size-5" />,
        tooltip: "System Default",
    },
    {
        theme: PreferredTheme.DARK,
        icon: <Moon className="size-5" />,
        tooltip: "Dark Theme",
    },
    {
        theme: PreferredTheme.LIGHT,
        icon: <Sun className="size-5" />,
        tooltip: "Light Theme",
    },
]

const ThemeSelector: React.FC = () => {
    const theme = useSettingsStore((state) => state.theme)
    const [hovering, setHovering] = useState(false)

    return (
        <div
            className="flex items-center"
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
        >
            {meta.map((value) => {
                const isVisible = hovering || value.theme === theme
                return (
                    <div
                        key={value.theme}
                        className="overflow-hidden transition-all duration-200"
                        style={{ width: isVisible ? "36px" : "0px", opacity: isVisible ? 1 : 0 }}
                    >
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-none"
                                    onClick={() => useSettingsStore.setState({ theme: value.theme })}
                                >
                                    {value.icon}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{value.tooltip}</TooltipContent>
                        </Tooltip>
                    </div>
                )
            })}
        </div>
    )
}
export default ThemeSelector
