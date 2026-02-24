import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { ToggleGroup, ToggleGroupItem } from "@components/ui/toggle-group"
import useSettingsStore, { PreferredTheme } from "@stores/use-settings-store"
import { Monitor, Moon, Sun } from "lucide-react"
import React from "react"

const meta = [
    {
        theme: PreferredTheme.SYSTEM,
        icon: <Monitor className="size-4" />,
        tooltip: "System Default",
    },
    {
        theme: PreferredTheme.DARK,
        icon: <Moon className="size-4" />,
        tooltip: "Dark Theme",
    },
    {
        theme: PreferredTheme.LIGHT,
        icon: <Sun className="size-4" />,
        tooltip: "Light Theme",
    },
]

const ThemeSelector: React.FC = () => {
    const theme = useSettingsStore((state) => state.theme)
    return (
        <ToggleGroup
            type="single"
            variant="outline"
            value={theme}
            onValueChange={(value: string) => {
                if (value) useSettingsStore.setState({ theme: value as PreferredTheme })
            }}
            aria-label="Theme"
        >
            {meta.map((item, index) => (
                <Tooltip key={index}>
                    <TooltipTrigger asChild>
                        <ToggleGroupItem value={item.theme} aria-label={item.tooltip}>
                            {item.icon}
                        </ToggleGroupItem>
                    </TooltipTrigger>
                    <TooltipContent>{item.tooltip}</TooltipContent>
                </Tooltip>
            ))}
        </ToggleGroup>
    )
}

export default ThemeSelector
