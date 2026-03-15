import { Badge } from "@components/ui/badge"
import { cn } from "@lib/utils"
import { ConnectionStatusIndicator } from "@components/connection-status"
import TimeSince from "@components/common/distance-timer"
import { type HomepageThroughputPoint } from "@hooks/use-homepage-summary"
import { Activity, AlertTriangle, Clock3, Server, Workflow } from "lucide-react"
import React from "react"

interface ClusterSummaryStripProps {
    onlineWorkers: number
    recentTaskCount: number
    recentFailureCount: number
    latestTaskUpdatedAt: string | null
    throughput: HomepageThroughputPoint[]
}

const SummaryMetric: React.FC<{
    label: string
    value: React.ReactNode
    icon: React.ReactNode
    tone?: "default" | "danger"
}> = ({ label, value, icon, tone = "default" }) => (
    <div
        className={cn(
            "flex min-w-0 items-center gap-3 rounded-2xl border px-4 py-3",
            tone === "danger" ? "border-destructive/20 bg-destructive/5" : "border-border/60 bg-background/70",
        )}
    >
        <div
            className={cn(
                "rounded-xl p-2",
                tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
            )}
        >
            {icon}
        </div>
        <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            <div className="truncate text-lg font-semibold">{value}</div>
        </div>
    </div>
)

const ThroughputSparkline: React.FC<{ data: HomepageThroughputPoint[] }> = ({ data }) => {
    if (!data.length) {
        return <div className="h-12 rounded-2xl border border-dashed border-border/70 bg-background/70" />
    }

    const maxCount = Math.max(...data.map((point) => point.tasks), 1)

    return (
        <div className="flex h-12 items-end gap-1 rounded-2xl border border-border/60 bg-background/70 px-3 py-2">
            {data.map((point) => (
                <div
                    key={point.bucket}
                    className="flex h-full flex-1 items-end"
                    title={`${new Date(point.bucket).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}: ${point.tasks}`}
                >
                    <div
                        className="w-full rounded-sm bg-primary/70"
                        style={{ height: `${Math.max((point.tasks / maxCount) * 100, point.tasks > 0 ? 18 : 8)}%` }}
                    />
                </div>
            ))}
        </div>
    )
}

const getStatusMessage = (recentTaskCount: number, recentFailureCount: number) => {
    if (recentFailureCount > 0) {
        return `${recentFailureCount} recent ${recentFailureCount === 1 ? "failure needs" : "failures need"} attention`
    }
    if (recentTaskCount > 0) {
        return "Tasks are flowing normally"
    }
    return "No recent activity yet"
}

const ClusterSummaryStrip: React.FC<ClusterSummaryStripProps> = ({
    onlineWorkers,
    recentTaskCount,
    recentFailureCount,
    latestTaskUpdatedAt,
    throughput,
}) => {
    const statusMessage = getStatusMessage(recentTaskCount, recentFailureCount)

    return (
        <section className="mx-6 mt-6 rounded-3xl border border-border/70 bg-card/95 p-4 shadow-sm">
            <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="flex min-w-0 flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <ConnectionStatusIndicator />
                        <Badge
                            variant="outline"
                            className={cn(
                                "rounded-full px-3 py-1 text-sm",
                                recentFailureCount > 0 && "border-destructive/30 bg-destructive/10 text-destructive",
                            )}
                        >
                            {statusMessage}
                        </Badge>
                        {latestTaskUpdatedAt ? (
                            <span className="text-sm text-muted-foreground">
                                Latest update <TimeSince time={new Date(latestTaskUpdatedAt)} addSuffix />
                            </span>
                        ) : (
                            <span className="text-sm text-muted-foreground">Waiting for task events</span>
                        )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <SummaryMetric
                            label="Online Workers"
                            value={onlineWorkers}
                            icon={<Server className="size-4" />}
                        />
                        <SummaryMetric
                            label="Recent Tasks"
                            value={recentTaskCount}
                            icon={<Workflow className="size-4" />}
                        />
                        <SummaryMetric
                            label="Recent Failures"
                            value={recentFailureCount}
                            icon={<AlertTriangle className="size-4" />}
                            tone={recentFailureCount > 0 ? "danger" : "default"}
                        />
                        <SummaryMetric
                            label="Freshness"
                            value={
                                latestTaskUpdatedAt ? (
                                    <TimeSince time={new Date(latestTaskUpdatedAt)} addSuffix />
                                ) : (
                                    "No events"
                                )
                            }
                            icon={<Clock3 className="size-4" />}
                        />
                    </div>
                </div>
                <div className="min-w-0 rounded-2xl border border-border/60 bg-muted/20 p-3">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <Activity className="size-4 text-primary" />
                        Throughput
                    </div>
                    <ThroughputSparkline data={throughput} />
                    <p className="mt-2 text-xs text-muted-foreground">Last hour of task activity in compact form.</p>
                </div>
            </div>
        </section>
    )
}

export default ClusterSummaryStrip
