import Panel from "@components/common/Panel"
import OnlineClientsPanel from "@components/settings/OnlineClientsPanel"
import { ServerInfoPanel } from "@components/settings/ServerInfoPanel"
import Button from "@mui/material/Button"
import Grid from "@mui/material/Grid"
import useSettingsStore from "@stores/useSettingsStore"
import React from "react"

const SettingsPage: React.FC = () => {
    const hideWelcomeBanner = useSettingsStore((state) => state.hideWelcomeBanner)
    return (
        <Grid container spacing={3} px={3}>
            <Grid item xs={12} md={6} lg={8}>
                <Panel title="Settings">
                    <Button
                        onClick={() => useSettingsStore.setState({ hideWelcomeBanner: false })}
                        disabled={!hideWelcomeBanner}
                    >
                        Enable welcome banner
                    </Button>
                </Panel>
            </Grid>
            <Grid item xs={12} md={6} lg={4}>
                <ServerInfoPanel />
                <OnlineClientsPanel />
            </Grid>
        </Grid>
    )
}
export default SettingsPage
