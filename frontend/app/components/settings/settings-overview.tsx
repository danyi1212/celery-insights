import { useSurrealDB } from "@components/surrealdb-provider"
import {
    describeDurability,
    formatConnectionStatus,
    formatDurability,
    formatIngestionStatus,
    formatTopology,
    formatVersion,
} from "@components/settings/settings-formatters"
import { useDemoRecordCounts } from "@components/settings/use-demo-record-counts"
import { useSettingsDiagnostics } from "@components/settings/use-settings-diagnostics"
import { Badge } from "@components/ui/badge"
import useSettingsStore, { PreferredTheme } from "@stores/use-settings-store"
import { Database, Gauge, HardDrive, SlidersHorizontal } from "lucide-react"

const themeLabels: Record<PreferredTheme, string> = {
    [PreferredTheme.SYSTEM]: "System",
    [PreferredTheme.DARK]: "Dark",
    [PreferredTheme.LIGHT]: "Light",
}

const SummaryCard = ({
    icon,
    title,
    value,
    hint,
    badge,
}: {
    icon: React.ReactNode
    title: string
    value: string
    hint: string
    badge?: React.ReactNode
}) => (
    <div className="rounded-3xl border bg-card/80 p-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {icon}
            <span>{title}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="text-lg font-semibold">{value}</div>
            {badge}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
    </div>
)

const SettingsOverview = () => {
    const theme = useSettingsStore((state) => state.theme)
    const hideWelcomeBanner = useSettingsStore((state) => state.hideWelcomeBanner)
    const isDemo = useSettingsStore((state) => state.demo)
    const rawEventsLimit = useSettingsStore((state) => state.rawEventsLimit)
    const { status, ingestionStatus } = useSurrealDB()
    const { data, error } = useSettingsDiagnostics({ enabled: !isDemo })
    const { data: demoCounts, isLoading: isLoadingDemoCounts } = useDemoRecordCounts({ enabled: isDemo })

    const durability = data?.surrealdb.durability
    const topology = data?.surrealdb.topology
    const diagnosticsUnavailable = Boolean(error)
    const storedDataValue = isDemo
        ? demoCounts
            ? `${demoCounts.tasks.toLocaleString()} tasks`
            : isLoadingDemoCounts
              ? "Loading..."
              : "Sample dataset"
        : data
          ? `${data.task_count.toLocaleString()} tasks`
          : diagnosticsUnavailable
            ? "Unavailable"
            : "Loading..."
    const storedDataHint = isDemo
        ? demoCounts
            ? `${demoCounts.events.toLocaleString()} events · ${demoCounts.workers.toLocaleString()} workers`
            : "Reading counts from the in-browser demo database."
        : data
          ? `${data.event_count.toLocaleString()} events · ${data.worker_count.toLocaleString()} workers`
          : diagnosticsUnavailable
            ? "Record counts could not be loaded."
            : "Counting records in SurrealDB."

    return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
                icon={<SlidersHorizontal className="size-4" />}
                title="This browser"
                value={themeLabels[theme]}
                hint={`${hideWelcomeBanner ? "Banner hidden" : "Banner visible"} · ${isDemo ? "Sample data" : "Live data"} · ${rawEventsLimit} events`}
                badge={<Badge variant="outline">Local</Badge>}
            />
            <SummaryCard
                icon={<HardDrive className="size-4" />}
                title="Database"
                value={
                    isDemo
                        ? "Sample data"
                        : data
                          ? formatTopology(topology)
                          : diagnosticsUnavailable
                            ? "Unavailable"
                            : "Loading..."
                }
                hint={
                    isDemo
                        ? "No live SurrealDB details are loaded in demo mode."
                        : data
                          ? describeDurability(durability)
                          : diagnosticsUnavailable
                            ? "System details could not be loaded."
                            : "Checking the connected SurrealDB instance."
                }
                badge={
                    isDemo ? (
                        <Badge variant="outline">Demo</Badge>
                    ) : data ? (
                        <Badge variant="outline">{formatDurability(durability)}</Badge>
                    ) : undefined
                }
            />
            <SummaryCard
                icon={<Gauge className="size-4" />}
                title="Runtime"
                value={isDemo ? "Demo mode" : formatConnectionStatus(status)}
                hint={
                    isDemo
                        ? "No live instance connection is used while sample data is active."
                        : `${formatIngestionStatus(ingestionStatus)}${data ? ` · ${formatVersion(data.server_version)}` : ""}`
                }
                badge={
                    <Badge variant={isDemo || status === "connected" ? "secondary" : "destructive"}>
                        {isDemo ? "Demo" : formatIngestionStatus(ingestionStatus)}
                    </Badge>
                }
            />
            <SummaryCard
                icon={<Database className="size-4" />}
                title="Stored data"
                value={storedDataValue}
                hint={storedDataHint}
            />
        </div>
    )
}

export default SettingsOverview
