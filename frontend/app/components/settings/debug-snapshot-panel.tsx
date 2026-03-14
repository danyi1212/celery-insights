import Panel from "@components/common/panel"
import { useSurrealDB } from "@components/surrealdb-provider"
import { Badge } from "@components/ui/badge"
import { useDebugSnapshotDetails } from "@components/settings/use-settings-diagnostics"
import { format } from "date-fns"

const JsonPreview = ({ title, value }: { title: string; value: unknown }) => (
    <div className="rounded-2xl border bg-background/50 p-4">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">
            {JSON.stringify(value, null, 2)}
        </pre>
    </div>
)

const LogPreview = ({ title, value }: { title: string; value: string }) => (
    <div className="rounded-2xl border bg-background/50 p-4">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
            {value || "No captured lines"}
        </pre>
    </div>
)

export const DebugSnapshotPanel = ({ hideHeader = false }: { hideHeader?: boolean }) => {
    const { appConfig } = useSurrealDB()
    const enabled = appConfig?.debugSnapshot?.enabled === true
    const { data, isLoading, error } = useDebugSnapshotDetails({ enabled })

    if (!enabled) return null

    return (
        <Panel title="Snapshot overview" hideHeader={hideHeader} loading={isLoading} error={error}>
            <div className="space-y-6 p-4">
                <div className="rounded-2xl border bg-background/60 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">Snapshot replay</Badge>
                        <Badge variant="outline">
                            {data?.manifest.source.redacted ? "Secrets redacted" : "Secrets included"}
                        </Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">Mounted bundle: {data?.bundlePath}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Captured {data ? format(new Date(data.manifest.source.createdAt), "PPP p") : "—"}
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border bg-background/40 p-4">
                        <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            Records
                        </div>
                        <div className="mt-2 text-sm font-medium">
                            {data
                                ? `${data.manifest.source.recordCounts.tasks.toLocaleString()} tasks · ${data.manifest.source.recordCounts.events.toLocaleString()} events · ${data.manifest.source.recordCounts.workers.toLocaleString()} workers`
                                : "—"}
                        </div>
                    </div>
                    <div className="rounded-2xl border bg-background/40 p-4">
                        <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            Bundle format
                        </div>
                        <div className="mt-2 text-sm font-medium">v{data?.manifest.version ?? "—"}</div>
                    </div>
                    <div className="rounded-2xl border bg-background/40 p-4">
                        <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            Replay state
                        </div>
                        <div className="mt-2 text-sm font-medium">Offline and read-only</div>
                    </div>
                    <div className="rounded-2xl border bg-background/40 p-4">
                        <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            Source timezone
                        </div>
                        <div className="mt-2 text-sm font-medium">{String(data?.sourceRuntime.timezone ?? "—")}</div>
                    </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                    <JsonPreview title="Source config" value={data?.sourceConfig ?? {}} />
                    <JsonPreview title="Source versions" value={data?.sourceVersions ?? {}} />
                    <JsonPreview title="Source runtime" value={data?.sourceRuntime ?? {}} />
                    <JsonPreview title="Source UI settings" value={data?.sourceUi ?? {}} />
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                    <LogPreview title="Bun log" value={data?.sourceLogs.bun ?? ""} />
                    <LogPreview title="Python log" value={data?.sourceLogs.python ?? ""} />
                    <LogPreview title="SurrealDB log" value={data?.sourceLogs.surrealdb ?? ""} />
                </div>
            </div>
        </Panel>
    )
}
