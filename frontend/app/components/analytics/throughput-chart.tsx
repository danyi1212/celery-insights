import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import type { ThroughputPoint } from "@hooks/use-analytics"
import { Loader2 } from "lucide-react"
import { useMemo } from "react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

const formatTime = (bucket: string) => {
    const date = new Date(bucket)
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

const ThroughputChart = ({ data, isLoading }: { data: ThroughputPoint[]; isLoading: boolean }) => {
    const chartData = useMemo(() => data.map((d) => ({ ...d, time: formatTime(d.bucket) })), [data])

    return (
        <Card>
            <CardHeader>
                <CardTitle>Task Throughput</CardTitle>
                <CardDescription>Tasks processed over time</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex h-[300px] items-center justify-center">
                        <Loader2 className="size-8 animate-spin text-primary" />
                    </div>
                ) : data.length === 0 ? (
                    <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                        No task data in the selected time range
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="time" className="text-xs" tick={{ fill: "var(--muted-foreground)" }} />
                            <YAxis
                                className="text-xs"
                                tick={{ fill: "var(--muted-foreground)" }}
                                allowDecimals={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "var(--popover)",
                                    border: "1px solid var(--border)",
                                    borderRadius: "8px",
                                    color: "var(--popover-foreground)",
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="count"
                                name="Tasks"
                                stroke="var(--chart-1)"
                                fill="var(--chart-1)"
                                fillOpacity={0.2}
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    )
}

export default ThroughputChart
