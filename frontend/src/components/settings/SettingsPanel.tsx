import DetailItem from "@components/common/DetailItem"
import Panel from "@components/common/Panel"
import ThemeSelector from "@components/settings/ThemeSelector"
import Button from "@mui/material/Button"
import Grid from "@mui/material/Grid"
import Switch from "@mui/material/Switch"
import Tooltip from "@mui/material/Tooltip"
import useSettingsStore, { resetSettings } from "@stores/useSettingsStore"
import React from "react"

const SettingsPanel = () => {
    const hideWelcomeBanner = useSettingsStore((state) => state.hideWelcomeBanner)

    return (
        <Panel
            title="Settings"
            actions={
                <Button variant="outlined" color="secondary" onClick={() => resetSettings()}>
                    Reset
                </Button>
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
            </Grid>
        </Panel>
    )
}
export default SettingsPanel
