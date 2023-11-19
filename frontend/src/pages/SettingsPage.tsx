import OnlineClientsPanel from "@components/settings/OnlineClientsPanel"
import { ServerInfoPanel } from "@components/settings/ServerInfoPanel"
import SettingsPanel from "@components/settings/SettingsPanel"
import Button from "@mui/material/Button"
import Grid from "@mui/material/Grid"
import useSettingsStore from "@stores/useSettingsStore"
import React from "react"

const handleDownloadDebugBundle = async () => {
    const response = await fetch("/api/settings/download-debug-bundle", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            settings: useSettingsStore.getState(),
            screen_height: window.innerHeight,
            screen_width: window.innerWidth,
        }),
    })
    if (!response.ok) return

    const blob = await response.blob()
    const blobUrl = window.URL.createObjectURL(blob)

    const anchor = document.createElement("a")
    anchor.href = blobUrl
    anchor.download = "debug_bundle.zip"
    document.body.appendChild(anchor)
    anchor.click() // Programmatically click the anchor to trigger the download

    document.body.removeChild(anchor)
    URL.revokeObjectURL(blobUrl)
}

const SettingsPage: React.FC = () => {
    const isDemo = useSettingsStore((state) => state.demo)
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
                <Button
                    variant="outlined"
                    color="secondary"
                    sx={{ mx: 5 }}
                    onClick={handleDownloadDebugBundle}
                    disabled={isDemo}
                >
                    Download Debug Bundle
                </Button>
            </Grid>
        </Grid>
    )
}
export default SettingsPage
