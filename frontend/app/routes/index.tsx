import { createFileRoute } from "@tanstack/react-router"
import ExceptionsSummary from "@components/task/alerts/exceptions-summary"
import RecentTasksPanel from "@components/task/recent-tasks-panel"
import WelcomeBanner from "@components/welcome-banner"
import WorkersSummaryStack from "@components/worker/workers-summary-stack"
import useSettingsStore from "@stores/use-settings-store"
import { useStateStore } from "@stores/use-state-store"
import { AlertCircle, Loader2 } from "lucide-react"
import { ReadyState } from "react-use-websocket"

const HomePage = () => {
    const hideWelcomeBanner = useSettingsStore((state) => state.hideWelcomeBanner)
    const isDemo = useSettingsStore((state) => state.demo)
    const wsStatus = useStateStore((state) => state.status)
    if (!isDemo && wsStatus !== ReadyState.OPEN) {
        return (
            <div className="flex h-full flex-col items-center justify-center">
                {wsStatus === ReadyState.CONNECTING || wsStatus === ReadyState.UNINSTANTIATED ? (
                    <Loader2 className="size-8 animate-spin text-primary" />
                ) : (
                    <>
                        <div className="mb-4 flex items-center">
                            <AlertCircle className="mr-3 size-10 text-destructive" />
                            <h3 className="text-3xl font-semibold">Unable to connect to the server</h3>
                        </div>
                        <ul className="text-xl">
                            <li>Make sure you are connected to the network</li>
                            <li>Check the server logs for any error messages or issues</li>
                            <li>Try restarting the server</li>
                        </ul>
                    </>
                )}
            </div>
        )
    }
    return (
        <>
            {!hideWelcomeBanner && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <WelcomeBanner />
                </div>
            )}
            <ExceptionsSummary />
            <div className="grid grid-cols-12 gap-6 px-6">
                <div className="col-span-12 lg:col-span-8">
                    <RecentTasksPanel id="recent-tasks" />
                </div>
                <div className="col-span-12 lg:col-span-4">
                    <WorkersSummaryStack />
                </div>
            </div>
        </>
    )
}

export const Route = createFileRoute("/")({
    component: HomePage,
})
