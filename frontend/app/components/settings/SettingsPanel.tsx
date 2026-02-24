import DetailItem from "@components/common/DetailItem"
import Panel from "@components/common/Panel"
import ThemeSelector from "@components/settings/ThemeSelector"
import { Button } from "@components/ui/button"
import { Switch } from "@components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import useSettingsStore, { resetSettings, useIsDefaultSettings } from "@stores/useSettingsStore"
import { useStateStore } from "@stores/useStateStore"
import React from "react"

const SettingsPanel = () => {
    const hideWelcomeBanner = useSettingsStore((state) => state.hideWelcomeBanner)
    const isDemo = useSettingsStore((state) => state.demo)
    const [taskCount, taskMax, workerCount, workerMax] = useStateStore((state) => [
        state.tasks.size,
        state.tasks.max,
        state.workers.size,
        state.workers.max,
    ])
    const isDefaultSettings = useIsDefaultSettings()

    return (
        <Panel
            title="Settings"
            actions={
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" onClick={() => resetSettings()} disabled={isDefaultSettings}>
                            Set Default
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reset to default settings</TooltipContent>
                </Tooltip>
            }
        >
            <div className="space-y-4 p-4">
                <DetailItem label="Theme" value={<ThemeSelector />} />
                <DetailItem
                    label="Show welcome banner"
                    value={
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Switch
                                    checked={!hideWelcomeBanner}
                                    onCheckedChange={(checked) =>
                                        useSettingsStore.setState({ hideWelcomeBanner: !checked })
                                    }
                                />
                            </TooltipTrigger>
                            <TooltipContent side="right">{hideWelcomeBanner ? "Hidden" : "Visible"}</TooltipContent>
                        </Tooltip>
                    }
                />
                <DetailItem
                    label="Demo mode"
                    value={
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Switch
                                    checked={isDemo}
                                    disabled={Boolean(import.meta.env.VITE_DEMO_MODE)}
                                    onCheckedChange={(checked) => useSettingsStore.setState({ demo: checked })}
                                />
                            </TooltipTrigger>
                            <TooltipContent side="right">{isDemo ? "Simulator" : "Real Server"}</TooltipContent>
                        </Tooltip>
                    }
                />
                <DetailItem
                    label="Tasks Memory"
                    description="Number of tasks keeped in the browser memory."
                    value={`${taskCount} / ${taskMax}`}
                />
                <DetailItem
                    label="Workers Memory"
                    description="Number of workers keeped in the browser memory."
                    value={`${workerCount} / ${workerMax}`}
                />
            </div>
        </Panel>
    )
}
export default SettingsPanel
