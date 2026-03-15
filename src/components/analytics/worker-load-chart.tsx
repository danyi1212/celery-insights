import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import type { WorkerLoadPoint } from "@hooks/use-analytics"
import { Loader2 } from "lucide-react"
import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

const shortenWorker = (worker: string) => {
  const atIdx = worker.indexOf("@")
  return atIdx >= 0 ? worker.substring(0, atIdx) : worker
}

const WorkerLoadChart = ({ data, isLoading }: { data: WorkerLoadPoint[]; isLoading: boolean }) => {
  const chartData = useMemo(
    () =>
      data.map((d, i) => ({
        ...d,
        shortWorker: shortenWorker(d.worker),
        fill: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [data],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Worker Load</CardTitle>
        <CardDescription>Tasks processed per worker</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-[300px] items-center justify-center">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No worker data in the selected time range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="shortWorker" className="text-xs" tick={{ fill: "var(--muted-foreground)" }} />
              <YAxis className="text-xs" tick={{ fill: "var(--muted-foreground)" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--popover-foreground)",
                }}
                labelFormatter={(_, payload) => {
                  if (payload?.[0]?.payload?.worker) return payload[0].payload.worker
                  return ""
                }}
              />
              <Bar dataKey="count" name="Tasks" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

export default WorkerLoadChart
