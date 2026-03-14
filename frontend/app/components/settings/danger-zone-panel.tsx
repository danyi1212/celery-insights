import Panel from "@components/common/panel"
import { useSurrealDB } from "@components/surrealdb-provider"
import { useSettingsDiagnostics } from "@components/settings/use-settings-diagnostics"
import { Button } from "@components/ui/button"
import useSettingsStore from "@stores/use-settings-store"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2, Trash2, TriangleAlert } from "lucide-react"
import React, { useEffect, useState } from "react"

const DangerZonePanel: React.FC<{ hideHeader?: boolean }> = ({ hideHeader = false }) => {
    const isDemo = useSettingsStore((state) => state.demo)
    const { appConfig } = useSurrealDB()
    const snapshotEnabled = appConfig?.debugSnapshot?.enabled === true
    const { data } = useSettingsDiagnostics()
    const queryClient = useQueryClient()
    const [confirming, setConfirming] = useState(false)
    const [isClearing, setIsClearing] = useState(false)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)

    useEffect(() => {
        if (!confirming) return
        const token = window.setTimeout(() => setConfirming(false), 8_000)
        return () => window.clearTimeout(token)
    }, [confirming])

    const handleClear = async () => {
        if (!confirming) {
            setConfirming(true)
            setStatusMessage("Click again within 8 seconds to delete all stored tasks, events, and workers.")
            return
        }

        setIsClearing(true)
        setStatusMessage(null)
        try {
            const res = await fetch("/api/settings/clear", { method: "POST" })
            const success = res.ok ? ((await res.json()) as boolean) : false
            if (!success) throw new Error("clear failed")

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["settings-info"] }),
                queryClient.invalidateQueries({ queryKey: ["retention-settings"] }),
            ])
            setStatusMessage("Stored data cleared.")
            setConfirming(false)
        } catch {
            setStatusMessage("Unable to clear stored data. Check the server logs and try again.")
        } finally {
            setIsClearing(false)
        }
    }

    return (
        <Panel title="Danger zone" hideHeader={hideHeader}>
            <div className="space-y-4 p-4">
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                    <div className="flex items-start gap-3">
                        <TriangleAlert className="mt-0.5 size-5 text-destructive" />
                        <div className="space-y-2">
                            <p className="font-medium text-destructive">
                                Delete all collected data from this instance.
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {data
                                    ? `This currently includes ${data.task_count.toLocaleString()} tasks, ${data.event_count.toLocaleString()} events, and ${data.worker_count.toLocaleString()} workers.`
                                    : "This removes every stored task, event, and worker record."}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Button
                        variant="destructive"
                        onClick={() => handleClear()}
                        disabled={isDemo || snapshotEnabled || isClearing}
                        aria-label="Clear stored data"
                    >
                        {isClearing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                        {confirming ? "Confirm clear all data" : "Clear stored data"}
                    </Button>
                    {(isDemo || snapshotEnabled) && (
                        <span className="text-sm text-muted-foreground">
                            {isDemo ? "Unavailable while demo mode is active." : "Disabled during snapshot replay."}
                        </span>
                    )}
                </div>
                {statusMessage && <p className="text-sm text-muted-foreground">{statusMessage}</p>}
            </div>
        </Panel>
    )
}

export default DangerZonePanel
