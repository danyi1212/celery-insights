import { createFileRoute } from "@tanstack/react-router"
import DurationByTypeChart from "@components/analytics/duration-by-type-chart"
import FailureRateChart from "@components/analytics/failure-rate-chart"
import ThroughputChart from "@components/analytics/throughput-chart"
import WorkerLoadChart from "@components/analytics/worker-load-chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import { useSurrealDB } from "@components/surrealdb-provider"
import { type TimeRange, useAnalytics } from "@hooks/use-analytics"
import { AlertCircle, Loader2 } from "lucide-react"
import { useState } from "react"

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
    "1h": "Last hour",
    "6h": "Last 6 hours",
    "24h": "Last 24 hours",
    "7d": "Last 7 days",
    "30d": "Last 30 days",
}

const AnalyticsPage = () => {
    const { status, error: connError } = useSurrealDB()
    const [timeRange, setTimeRange] = useState<TimeRange>("24h")
    const { data, isLoading, error } = useAnalytics(timeRange)

    if (status !== "connected") {
        return (
            <div className="flex h-full flex-col items-center justify-center">
                {status === "connecting" ? (
                    <Loader2 className="size-8 animate-spin text-primary" />
                ) : (
                    <>
                        <div className="mb-4 flex items-center">
                            <AlertCircle className="mr-3 size-10 text-destructive" />
                            <h3 className="text-3xl font-semibold">Unable to connect to the database</h3>
                        </div>
                        {connError && <p className="mt-4 text-sm text-muted-foreground">{connError.message}</p>}
                    </>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-semibold">Analytics</h2>
                <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {(Object.entries(TIME_RANGE_LABELS) as [TimeRange, string][]).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
                    {error.message}
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <ThroughputChart data={data.throughput} isLoading={isLoading} />
                <FailureRateChart data={data.failureRate} isLoading={isLoading} />
                <DurationByTypeChart data={data.durationByType} isLoading={isLoading} />
                <WorkerLoadChart data={data.workerLoad} isLoading={isLoading} />
            </div>
        </div>
    )
}

export const Route = createFileRoute("/analytics")({
    component: AnalyticsPage,
})
