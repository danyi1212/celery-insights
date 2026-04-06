import type { HistogramPoint } from "@hooks/use-explorer-data"
import { Loader2 } from "lucide-react"
import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface ExplorerActivityChartProps {
  data: HistogramPoint[]
  isLoading: boolean
  emptyLabel: string
  rangeStart: string
  rangeEnd: string
}

const BUCKET_COUNT = 15

const formatTime = (value: number) =>
  new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })

const buildChartData = (data: HistogramPoint[], rangeStart: string, rangeEnd: string) => {
  const startMs = new Date(rangeStart).getTime()
  const endMs = new Date(rangeEnd).getTime()

  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return []
  }

  const bucketMs = Math.max((endMs - startMs) / BUCKET_COUNT, 1)
  const buckets = Array.from({ length: BUCKET_COUNT }, (_, index) => {
    const bucketStart = startMs + index * bucketMs
    return {
      bucketStart,
      count: 0,
      time: formatTime(bucketStart),
    }
  })

  for (const row of data) {
    const bucketTime = new Date(row.bucket).getTime()
    if (Number.isNaN(bucketTime)) continue
    const normalized = Math.min(Math.max(bucketTime - startMs, 0), Math.max(endMs - startMs - 1, 0))
    const index = Math.min(Math.floor(normalized / bucketMs), BUCKET_COUNT - 1)
    buckets[index].count += row.count
  }

  return buckets
}

const ExplorerActivityChart = ({ data, isLoading, emptyLabel, rangeStart, rangeEnd }: ExplorerActivityChartProps) => {
  const chartData = useMemo(() => buildChartData(data, rangeStart, rangeEnd), [data, rangeEnd, rangeStart])
  const hasValues = chartData.some((row) => row.count > 0)

  return (
    <div>
      {isLoading ? (
        <div className="flex h-[220px] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : !hasValues ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">{emptyLabel}</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="time" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} minTickGap={24} />
            <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} width={28} />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                color: "var(--popover-foreground)",
              }}
            />
            <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export default ExplorerActivityChart
