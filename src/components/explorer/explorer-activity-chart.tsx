import type { HistogramPoint } from "@hooks/use-explorer-data"
import { cn } from "@lib/utils"
import { Loader2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface ChartSeries {
  key: string
  label: string
  color: string
  states?: string[]
}

interface ExplorerActivityChartProps {
  data: HistogramPoint[]
  isLoading: boolean
  emptyLabel: string
  rangeStart: string
  rangeEnd: string
  series?: ChartSeries[]
  onSelectRange?: (selection: { start: string; end: string }) => void
}

const BUCKET_COUNT = 15
const CHART_MARGIN = { top: 8, right: 8, bottom: 8, left: 8 } as const
const X_AXIS_HEIGHT = 24
const Y_AXIS_WIDTH = 28
const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

type ChartDatum = {
  bucketIndex: number
  bucketStart: number
  bucketEnd: number
  time: string
} & Record<string, number | string>

const formatTime = (value: number) => timeFormatter.format(new Date(value))

const getBucketIndexFromClientX = (clientX: number, rect: DOMRect, bucketCount: number) => {
  if (rect.width <= 0 || bucketCount <= 0) {
    return null
  }

  const clampedX = Math.min(Math.max(clientX - rect.left, 0), Math.max(rect.width - 1, 0))
  return Math.min(Math.floor((clampedX / rect.width) * bucketCount), bucketCount - 1)
}

export const buildChartData = (data: HistogramPoint[], rangeStart: string, rangeEnd: string, series: ChartSeries[]) => {
  const startMs = new Date(rangeStart).getTime()
  const endMs = new Date(rangeEnd).getTime()

  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return []
  }

  const bucketMs = Math.max((endMs - startMs) / BUCKET_COUNT, 1)
  const buckets = Array.from({ length: BUCKET_COUNT }, (_, index) => {
    const bucketStart = startMs + index * bucketMs
    return series.reduce(
      (acc, item) => {
        acc[item.key] = 0
        return acc
      },
      {
        bucketIndex: index,
        bucketStart,
        bucketEnd: Math.min(bucketStart + bucketMs, endMs),
        time: formatTime(bucketStart),
      } as ChartDatum,
    )
  })

  for (const row of data) {
    const bucketTime = new Date(row.bucket).getTime()
    if (Number.isNaN(bucketTime)) continue
    const normalized = Math.min(Math.max(bucketTime - startMs, 0), Math.max(endMs - startMs - 1, 0))
    const index = Math.min(Math.floor(normalized / bucketMs), BUCKET_COUNT - 1)
    const seriesKey = series.find((item) => item.states?.includes(row.state ?? ""))?.key ?? series[0]?.key

    if (!seriesKey) continue
    buckets[index][seriesKey] = Number(buckets[index][seriesKey] ?? 0) + row.count
  }

  return buckets
}

const defaultSeries: ChartSeries[] = [{ key: "count", label: "Count", color: "var(--chart-1)" }]

const ExplorerActivityChart = ({
  data,
  isLoading,
  emptyLabel,
  rangeStart,
  rangeEnd,
  series,
  onSelectRange,
}: ExplorerActivityChartProps) => {
  const activeSeries = series && series.length > 0 ? series : defaultSeries
  const chartData = useMemo(
    () => buildChartData(data, rangeStart, rangeEnd, activeSeries),
    [activeSeries, data, rangeEnd, rangeStart],
  )
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null)
  const [dragCurrentIndex, setDragCurrentIndex] = useState<number | null>(null)
  const hasValues = chartData.some((row) => activeSeries.some((item) => Number(row[item.key] ?? 0) > 0))
  const selectionStartIndex =
    dragStartIndex === null || dragCurrentIndex === null ? null : Math.min(dragStartIndex, dragCurrentIndex)
  const selectionEndIndex =
    dragStartIndex === null || dragCurrentIndex === null ? null : Math.max(dragStartIndex, dragCurrentIndex)
  const selectionStyle =
    selectionStartIndex === null || selectionEndIndex === null
      ? null
      : {
          left: `${(selectionStartIndex / chartData.length) * 100}%`,
          width: `${((selectionEndIndex - selectionStartIndex + 1) / chartData.length) * 100}%`,
        }

  const commitSelection = (targetIndex: number | null) => {
    if (dragStartIndex === null || targetIndex === null || !onSelectRange) {
      setDragStartIndex(null)
      setDragCurrentIndex(null)
      return
    }

    const startIndex = Math.min(dragStartIndex, targetIndex)
    const endIndex = Math.max(dragStartIndex, targetIndex)
    const startBucket = chartData[startIndex]
    const endBucket = chartData[endIndex]

    setDragStartIndex(null)
    setDragCurrentIndex(null)

    if (!startBucket || !endBucket) {
      return
    }

    onSelectRange({
      start: new Date(startBucket.bucketStart).toISOString(),
      end: new Date(endBucket.bucketEnd).toISOString(),
    })
  }

  return (
    <div>
      {isLoading ? (
        <div className="flex h-[220px] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : !hasValues ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">{emptyLabel}</div>
      ) : (
        <div className="relative h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="time"
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                minTickGap={24}
                height={X_AXIS_HEIGHT}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                width={Y_AXIS_WIDTH}
              />
              <Tooltip
                labelFormatter={(value) => String(value)}
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--popover-foreground)",
                }}
              />
              {activeSeries.map((item) => (
                <Bar
                  key={item.key}
                  dataKey={item.key}
                  stackId="activity"
                  fill={item.color}
                  radius={[4, 4, 0, 0]}
                  barSize={Math.max(8, Math.floor(520 / chartData.length))}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>

          {onSelectRange ? (
            <button
              data-testid="activity-chart-overlay"
              type="button"
              aria-label="Select chart range"
              className="absolute z-10 select-none"
              style={{
                top: CHART_MARGIN.top,
                right: CHART_MARGIN.right,
                bottom: CHART_MARGIN.bottom + X_AXIS_HEIGHT,
                left: CHART_MARGIN.left + Y_AXIS_WIDTH,
              }}
              onMouseDown={(event) => {
                const nextIndex = getBucketIndexFromClientX(
                  event.clientX,
                  event.currentTarget.getBoundingClientRect(),
                  chartData.length,
                )
                if (nextIndex === null) return
                event.preventDefault()
                setDragStartIndex(nextIndex)
                setDragCurrentIndex(nextIndex)
              }}
              onMouseMove={(event) => {
                if (dragStartIndex === null) return
                const nextIndex = getBucketIndexFromClientX(
                  event.clientX,
                  event.currentTarget.getBoundingClientRect(),
                  chartData.length,
                )
                if (nextIndex === null) return
                setDragCurrentIndex(nextIndex)
              }}
              onMouseUp={(event) => {
                const nextIndex = getBucketIndexFromClientX(
                  event.clientX,
                  event.currentTarget.getBoundingClientRect(),
                  chartData.length,
                )
                commitSelection(nextIndex)
              }}
              onMouseLeave={() => {
                if (dragStartIndex !== null) {
                  commitSelection(dragCurrentIndex)
                }
              }}
            >
              {selectionStyle ? <div className={cn("absolute inset-y-0 bg-accent/12")} style={selectionStyle} /> : null}
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default ExplorerActivityChart
