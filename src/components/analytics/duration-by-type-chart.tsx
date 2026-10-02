import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import type { DurationByType } from "@hooks/use-analytics"
import { Loader2 } from "lucide-react"
import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

const shortenType = (type: string) => {
  const parts = type.split(".")
  return parts.length > 1 ? parts[parts.length - 1] : type
}

const DurationByTypeChart = ({ data, isLoading }: { data: DurationByType[]; isLoading: boolean }) => {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        shortType: shortenType(d.type),
        avg_runtime: Math.round(d.avg_runtime * 1000) / 1000,
        min_runtime: Math.round(d.min_runtime * 1000) / 1000,
        max_runtime: Math.round(d.max_runtime * 1000) / 1000,
      })),
    [data],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Task Duration by Type</CardTitle>
        <CardDescription>Average runtime (seconds) per task type</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-[300px] items-center justify-center">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No runtime data in the selected time range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" className="text-xs" tick={{ fill: "var(--muted-foreground)" }} unit="s" />
              <YAxis
                type="category"
                dataKey="shortType"
                className="text-xs"
                tick={{ fill: "var(--muted-foreground)" }}
                width={120}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--popover-foreground)",
                }}
                formatter={(value, name) => {
                  const labels: Record<string, string> = {
                    avg_runtime: "Avg",
                    min_runtime: "Min",
                    max_runtime: "Max",
                  }
                  return [`${value}s`, labels[name as string] ?? name]
                }}
              />
              <Bar dataKey="avg_runtime" name="avg_runtime" fill="var(--chart-3)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

export default DurationByTypeChart
