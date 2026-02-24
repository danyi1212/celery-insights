import { createFileRoute } from "@tanstack/react-router"
import { DownloadDebugBundleButton } from "@components/settings/DownloadDebugBundleButton"
import OnlineClientsPanel from "@components/settings/OnlineClientsPanel"
import { ServerInfoPanel } from "@components/settings/ServerInfoPanel"
import SettingsPanel from "@components/settings/SettingsPanel"

const SettingsPage = () => {
    return (
        <div className="grid grid-cols-1 gap-6 px-3 md:grid-cols-2 lg:grid-cols-12">
            <div className="lg:col-span-8">
                <SettingsPanel />
            </div>
            <div className="space-y-6 lg:col-span-4">
                <ServerInfoPanel />
                <OnlineClientsPanel />
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
