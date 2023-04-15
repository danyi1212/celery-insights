import Panel from "@components/common/Panel"
import Grid from "@mui/material/Grid"
import React from "react"

const SettingsPage: React.FC = () => {
    return (
        <Grid container spacing={3} px={3}>
            <Grid item xs={12} md={6} lg={8}>
                <Panel title="Settings"></Panel>
            </Grid>
            <Grid item xs={12} md={6} lg={4}>
                <Panel title="Server Info"></Panel>
                <Panel title="Online Clients"></Panel>
            </Grid>
        </Grid>
    )
}
export default SettingsPage
