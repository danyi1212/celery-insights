import { DownloadDebugBundleButton } from "@components/settings/DownloadDebugBundleButton"
import OnlineClientsPanel from "@components/settings/OnlineClientsPanel"
import { ServerInfoPanel } from "@components/settings/ServerInfoPanel"
import SettingsPanel from "@components/settings/SettingsPanel"
import Grid from "@mui/material/Grid"
import React from "react"

const SettingsPage: React.FC = () => {
    return (
        <Grid container spacing={3} px={3}>
            <Grid item xs={12} md={6} lg={8}>
                <SettingsPanel />
            </Grid>
            <Grid item xs={12} md={6} lg={4}>
                <ServerInfoPanel />
                <OnlineClientsPanel />
            </Grid>
            <Grid item xs={12} justifyContent="center" alignItems="center">
                <DownloadDebugBundleButton sx={{ mx: 5 }} />
            </Grid>
        </Grid>
    )
}
export default SettingsPage
