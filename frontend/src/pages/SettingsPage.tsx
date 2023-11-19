import OnlineClientsPanel from "@components/settings/OnlineClientsPanel"
import { ServerInfoPanel } from "@components/settings/ServerInfoPanel"
import SettingsPanel from "@components/settings/SettingsPanel"
import { useClient } from "@hooks/useClient"
import Button from "@mui/material/Button"
import Grid from "@mui/material/Grid"
import React from "react"

const SettingsPage: React.FC = () => {
    const client = useClient()

    const handleDownloadDebugBundle = () =>
        client.settings.downloadDebugBundle().then((response) => {
            const blob = new Blob([response], { type: "application/zip" })
            const blobUrl = URL.createObjectURL(blob)

            const anchor = document.createElement("a")
            anchor.href = blobUrl
            anchor.download = "debug_bundle.zip"
            document.body.appendChild(anchor)
            anchor.click() // Programmatically click the anchor to trigger the download

            document.body.removeChild(anchor)
            URL.revokeObjectURL(blobUrl)
        })

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
                <Button variant="outlined" color="secondary" sx={{ mx: 5 }} onClick={handleDownloadDebugBundle}>
                    Download Debug Bundle
                </Button>
            </Grid>
        </Grid>
    )
}
export default SettingsPage
