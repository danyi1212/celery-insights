import { DownloadDebugBundleButton } from "@components/settings/download-debug-bundle-button"
import Panel from "@components/common/panel"
import { useSurrealDB } from "@components/surrealdb-provider"
import {
    describeDurability,
    formatConnectionStatus,
    formatDurability,
    formatIngestionStatus,
    formatStorageEngine,
    formatTopology,
    formatVersion,
} from "@components/settings/settings-formatters"
import { useSettingsDiagnostics } from "@components/settings/use-settings-diagnostics"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import useSettingsStore from "@stores/use-settings-store"
import { formatBytes } from "@utils/format-bytes"
import { formatSecondsDurationLong } from "@utils/format-seconds-duration-long"
import { ChevronDown, RotateCw, Server } from "lucide-react"
import React, { useState } from "react"

const SummaryTile = ({
    title,
    value,
    hint,
    badge,
}: {
    title: string
    value: string
    hint: string
    badge?: React.ReactNode
}) => (
    <div className="rounded-2xl border bg-background/60 p-4">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="text-lg font-semibold">{value}</div>
            {badge}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
    </div>
)

const DetailGridItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="rounded-2xl border bg-background/40 p-4">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <div className="mt-2 text-sm font-medium text-foreground">{value}</div>
    </div>
)

export const ServerInfoPanel: React.FC<{ hideHeader?: boolean }> = ({ hideHeader = false }) => {
    const isDemo = useSettingsStore((state) => state.demo)
    const { data, isLoading, error } = useSettingsDiagnostics({ enabled: !isDemo })
    const { status, ingestionStatus, appConfig } = useSurrealDB()
    const [showAdvanced, setShowAdvanced] = useState(false)
    const snapshotEnabled = appConfig?.debugSnapshot?.enabled === true

    const cpuLoad = data?.cpu_usage ? data.cpu_usage.map((value) => value.toFixed(2)).join(" / ") : "—"
    const durability = data?.surrealdb.durability
    const topology = data?.surrealdb.topology

    return (
        <Panel title="System status" loading={isLoading} error={error} hideHeader={hideHeader}>
            <div className="space-y-6 p-4">
                {isDemo ? (
                    <div className="rounded-2xl border bg-background/60 p-5">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">Demo mode</Badge>
                            <span className="text-sm font-medium">Embedded sample data is active</span>
                        </div>
                        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
                            This browser is using the embedded sample database, so this section does not query
                            server-side runtime, diagnostics, or backup APIs from a real Celery Insights instance.
                        </p>
                    </div>
                ) : (
                    <>
                        <p className="max-w-3xl text-sm text-muted-foreground">
                            {snapshotEnabled
                                ? "This instance is replaying a mounted debug bundle. Runtime values stay read-only."
                                : "Check whether the app is connected, how data is stored, and whether ingestion is keeping up."}
                        </p>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <SummaryTile
                                title="Connectivity"
                                value={formatConnectionStatus(status)}
                                hint={formatIngestionStatus(ingestionStatus)}
                                badge={
                                    <Badge variant={status === "connected" ? "secondary" : "destructive"}>
                                        {formatIngestionStatus(ingestionStatus)}
                                    </Badge>
                                }
                            />
                            <SummaryTile
                                title="Storage"
                                value={data ? formatTopology(topology) : "Loading..."}
                                hint={data ? describeDurability(durability) : "Checking storage mode."}
                                badge={
                                    data ? <Badge variant="outline">{formatDurability(durability)}</Badge> : undefined
                                }
                            />
                            <SummaryTile
                                title="Stored data"
                                value={data ? `${data.task_count.toLocaleString()} tasks` : "Loading..."}
                                hint={
                                    data
                                        ? `${data.event_count.toLocaleString()} events · ${data.worker_count.toLocaleString()} workers`
                                        : "Counting records in SurrealDB."
                                }
                            />
                            <SummaryTile
                                title="Version"
                                value={data ? formatVersion(data.server_version) : "Loading..."}
                                hint={
                                    data
                                        ? `Up for ${formatSecondsDurationLong(data.uptime)}`
                                        : "Checking process runtime."
                                }
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            <DetailGridItem label="App" value={data?.server_name ?? "—"} />
                            <DetailGridItem label="Host" value={data?.server_hostname ?? "—"} />
                            <DetailGridItem label="Memory" value={formatBytes(data?.memory_usage ?? 0)} />
                            <DetailGridItem label="CPU load (1m / 5m / 15m)" value={cpuLoad} />
                            <DetailGridItem
                                label="Namespace / DB"
                                value={data ? `${data.surrealdb.namespace} / ${data.surrealdb.database}` : "—"}
                            />
                            <DetailGridItem
                                label="Engine"
                                value={data ? formatStorageEngine(data.surrealdb.storage) : "—"}
                            />
                        </div>

                        <div className="rounded-2xl border bg-background/40">
                            <Button
                                variant="ghost"
                                className="flex h-auto w-full items-center justify-between rounded-2xl px-4 py-3"
                                onClick={() => setShowAdvanced((open) => !open)}
                            >
                                <span className="flex items-center gap-2 text-sm font-medium">
                                    <Server className="size-4" />
                                    More details
                                </span>
                                <ChevronDown
                                    className={`size-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                                />
                            </Button>
                            {showAdvanced && (
                                <div className="grid gap-4 border-t px-4 py-4 md:grid-cols-2 xl:grid-cols-3">
                                    <DetailGridItem
                                        label="SurrealDB endpoint"
                                        value={data?.surrealdb.endpoint ?? "—"}
                                    />
                                    <DetailGridItem label="Timezone" value={data?.timezone ?? "—"} />
                                    <DetailGridItem label="Python version" value={data?.python_version ?? "—"} />
                                    <DetailGridItem label="OS" value={data?.server_os ?? "—"} />
                                    <DetailGridItem label="Port" value={data?.server_port ?? "—"} />
                                    <DetailGridItem
                                        label="Batch interval"
                                        value={data ? `${data.ingestion.batch_interval_ms} ms` : "—"}
                                    />
                                    <DetailGridItem label="Queue size" value={data?.ingestion.queue_size ?? "—"} />
                                    <DetailGridItem label="Buffer size" value={data?.ingestion.buffer_size ?? "—"} />
                                    <DetailGridItem
                                        label="Dropped events"
                                        value={data?.ingestion.dropped_events ?? "—"}
                                    />
                                    <DetailGridItem label="Flushes" value={data?.ingestion.flushes_total ?? "—"} />
                                    <DetailGridItem
                                        label="Events ingested"
                                        value={data?.ingestion.events_ingested_total ?? "—"}
                                    />
                                    <DetailGridItem
                                        label="Stored records"
                                        value={
                                            data
                                                ? `${data.task_count.toLocaleString()} tasks · ${data.event_count.toLocaleString()} events · ${data.worker_count.toLocaleString()} workers`
                                                : "—"
                                        }
                                    />
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </Panel>
    )
}

export const ServerInfoPanelAction = () => {
    const isDemo = useSettingsStore((state) => state.demo)
    const { isLoading, refetch } = useSettingsDiagnostics({ enabled: !isDemo })

    return (
        <div className="flex items-center gap-2">
            <DownloadDebugBundleButton />
            <Button
                variant="ghost"
                size="icon"
                onClick={() => refetch().then()}
                disabled={isLoading || isDemo}
                aria-label="Refresh runtime details"
            >
                <RotateCw className="size-4" />
            </Button>
        </div>
    )
}
