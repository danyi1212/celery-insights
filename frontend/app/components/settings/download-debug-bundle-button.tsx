import { Button } from "@components/ui/button"
import useSettingsStore from "@stores/use-settings-store"
import { Download, Loader2 } from "lucide-react"
import React, { useState } from "react"

export const DownloadDebugBundleButton: React.FC<{ label?: string }> = ({ label = "Download diagnostics" }) => {
    const isDemo = useSettingsStore((state) => state.demo)
    const [isLoading, setIsLoading] = useState(false)

    const handleDownloadDebugBundle = async () => {
        setIsLoading(true)
        try {
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
            anchor.click()

            document.body.removeChild(anchor)
            URL.revokeObjectURL(blobUrl)
        } catch (error) {
            console.error("Failed to download debug bundle:", error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Button variant="outline" onClick={handleDownloadDebugBundle} disabled={isDemo || isLoading}>
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            <span>{label}</span>
        </Button>
    )
}
