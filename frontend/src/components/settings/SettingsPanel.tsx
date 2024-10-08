import DetailItem from "@components/common/DetailItem"
import Panel from "@components/common/Panel"
import ThemeSelector from "@components/settings/ThemeSelector"
import Button from "@mui/material/Button"
import Grid from "@mui/material/Grid"
import Switch from "@mui/material/Switch"
import Tooltip from "@mui/material/Tooltip"
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
                <Tooltip title="Reset to default settings">
                    <Button
                        variant="outlined"
                        color="secondary"
                        onClick={() => resetSettings()}
                        disabled={isDefaultSettings}
                    >
                        Set Default
                    </Button>
                </Tooltip>
            }
        >
            <Grid container spacing={2} p={2}>
                <Grid item xs={12}>
                    <DetailItem label="Theme" value={<ThemeSelector />} />
                </Grid>
                <Grid item xs={12}>
                    <DetailItem
                        label="Show welcome banner"
                        value={
                            <Tooltip title={hideWelcomeBanner ? "Hidden" : "Visible"} placement="right">
                                <Switch
                                    checked={!hideWelcomeBanner}
                                    onChange={(event) =>
                                        useSettingsStore.setState({ hideWelcomeBanner: !event.target.checked })
                                    }
                                />
                            </Tooltip>
                        }
                    />
                </Grid>
                <Grid item xs={12}>
                    <DetailItem
                        label="Demo mode"
                        value={
                            <Tooltip title={isDemo ? "Simulator" : "Real Server"} placement="right">
                                <Switch
                                    checked={isDemo}
                                    disabled={Boolean(import.meta.env.VITE_DEMO_MODE)}
                                    onChange={(event) => useSettingsStore.setState({ demo: event.target.checked })}
                                />
                            </Tooltip>
                        }
                    />
                </Grid>
                <Grid item xs={12}>
                    <DetailItem
                        label="Tasks Memory"
                        description="Number of tasks keeped in the browser memory."
                        value={`${taskCount} / ${taskMax}`}
                    />
                </Grid>
                <Grid item xs={12}>
                    <DetailItem
                        label="Workers Memory"
                        description="Number of workers keeped in the browser memory."
                        value={`${workerCount} / ${workerMax}`}
                    />
                </Grid>
            </Grid>
        </Panel>
    )
}
export default SettingsPanel
