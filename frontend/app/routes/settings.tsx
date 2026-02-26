import { createFileRoute } from "@tanstack/react-router"
import { DownloadDebugBundleButton } from "@components/settings/download-debug-bundle-button"
import { ServerInfoPanel } from "@components/settings/server-info-panel"
import SettingsPanel from "@components/settings/settings-panel"

const SettingsPage = () => {
    return (
        <div className="grid grid-cols-1 gap-6 px-3 md:grid-cols-2 lg:grid-cols-12">
            <div className="lg:col-span-8">
                <SettingsPanel />
            </div>
            <div className="space-y-6 lg:col-span-4">
                <ServerInfoPanel />
            </div>
            <div className="col-span-full flex justify-center">
                <DownloadDebugBundleButton />
            </div>
        </div>
    )
}

export const Route = createFileRoute("/settings")({
    component: SettingsPage,
})
