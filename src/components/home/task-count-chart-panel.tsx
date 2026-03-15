import Panel from "@components/common/panel"
import { useHomepageSummary } from "@hooks/use-homepage-summary"
import React, { useMemo } from "react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

const legendItems = [
  { label: "Success", color: "var(--status-success)" },
  { label: "Errors", color: "var(--destructive)" },
]

const TaskCountChartPanel: React.FC = () => {
  const { data, isLoading, error } = useHomepageSummary()

  const chartData = useMemo(
    () =>
      data.throughput.map((point) => ({
        time: new Date(point.bucket).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        success: point.success,
        errors: point.errors,
      })),
    [data.throughput],
  )

  return (
    <Panel
      title="Task Counts"
      titleClassName="text-lg"
      headerClassName="min-h-11 px-3"
      loading={isLoading}
      error={error}
      className="p-2.5"
    >
      <div className="mb-1.5 flex items-center justify-end gap-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {legendItems.map((item) => (
          <div key={item.label} className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="successFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--status-success)" stopOpacity={0.28} />
                <stop offset="95%" stopColor="var(--status-success)" stopOpacity={0.06} />
              </linearGradient>
              <linearGradient id="errorFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--destructive)" stopOpacity={0.24} />
                <stop offset="95%" stopColor="var(--destructive)" stopOpacity={0.06} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
              minTickGap={24}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              width={28}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                color: "var(--popover-foreground)",
              }}
              labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
            />
            <Area
              type="monotone"
              dataKey="errors"
              name="Errors"
              stackId="activity"
              stroke="var(--destructive)"
              fill="url(#errorFill)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="success"
              name="Success"
              stackId="activity"
              stroke="var(--status-success)"
              fill="url(#successFill)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}

export default TaskCountChartPanel
