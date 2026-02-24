import DownloadIcon from "@mui/icons-material/Download"
import { LoadingButtonProps } from "@mui/lab"
import LoadingButton from "@mui/lab/LoadingButton"
import CircularProgress from "@mui/material/CircularProgress"
import useSettingsStore from "@stores/useSettingsStore"
import React, { useState } from "react"

export const DownloadDebugBundleButton: React.FC<LoadingButtonProps> = (props) => {
    const isDemo = useSettingsStore((state) => state.demo)
    const [isLoading, setIsLoading] = useState(false)

    const handleDownloadDebugBundle = async () => {
        setIsLoading(true)
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
        if (!response.ok) {
            setIsLoading(false)
            return
        }

        const blob = await response.blob()
        const blobUrl = window.URL.createObjectURL(blob)

        const anchor = document.createElement("a")
        anchor.href = blobUrl
        anchor.download = "debug_bundle.zip"
        document.body.appendChild(anchor)
        anchor.click() // Programmatically click the anchor to trigger the download

        document.body.removeChild(anchor)
        URL.revokeObjectURL(blobUrl)
        setIsLoading(false)
    }

    return (
        <LoadingButton
            variant="outlined"
            color="secondary"
            {...props}
            onClick={handleDownloadDebugBundle}
            disabled={isDemo}
            loading={isLoading}
            loadingPosition="start"
            startIcon={<DownloadIcon />}
            loadingIndicator={<CircularProgress color="inherit" size={16} />}
        >
            <span>Download Debug Bundle</span>
        </LoadingButton>
    )
}
