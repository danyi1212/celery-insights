import { createFileRoute } from "@tanstack/react-router"
import CopyLinkButton from "@components/common/copy-link-button"
import DownloadMenuButton from "@components/common/download-menu-button"
import LiveRefreshButton from "@components/common/live-refresh-button"
import AppTimeRangePicker from "@components/common/time-range-picker"
import ExplorerActivityChart from "@components/explorer/explorer-activity-chart"
import ExplorerResultsTable from "@components/explorer/explorer-results-table"
import FilterSection from "@components/explorer/filter-section"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useExplorerData, type ExplorerMode } from "@hooks/use-explorer-data"
import {
  createDefaultTimeRange,
  createStaticTimeRange,
  deserializeTimeRange,
  resolveTimeRangeBindings,
  serializeTimeRange,
} from "@lib/time-range-utils"
import { cn } from "@lib/utils"
import { downloadFile } from "@lib/export-tasks"
import { downloadServerCsvExport } from "@lib/server-export"
import { useTourChangeStepOnLoad } from "@stores/use-tour-store"
import { FileJson, FileSpreadsheet, GitBranch, PanelLeftClose, PanelLeftOpen, Search, Workflow } from "lucide-react"
import { parseAsArrayOf, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { isLiveTimeRange } from "@danyi1212/time-range-picker/time-range"
import { startTransition, useCallback, useDeferredValue, useMemo, useState } from "react"

const ExplorerPage = () => {
  const [params, setParams] = useQueryStates({
    mode: parseAsStringLiteral(["tasks", "workflows"] as const).withDefault("tasks"),
    range: parseAsString.withDefault("1h"),
    query: parseAsString.withDefault(""),
    states: parseAsArrayOf(parseAsString).withDefault([]),
    types: parseAsArrayOf(parseAsString).withDefault([]),
    workers: parseAsArrayOf(parseAsString).withDefault([]),
    workflowStates: parseAsArrayOf(parseAsString).withDefault([]),
    rootTypes: parseAsArrayOf(parseAsString).withDefault([]),
    sortField: parseAsString.withDefault("last_updated"),
    sortDirection: parseAsStringLiteral(["ASC", "DESC"] as const).withDefault("DESC"),
    pageCount: parseAsInteger.withDefault(1),
    taskColumns: parseAsArrayOf(parseAsString).withDefault([]),
    workflowColumns: parseAsArrayOf(parseAsString).withDefault([]),
  })

  const range = useMemo(() => deserializeTimeRange(params.range) ?? createDefaultTimeRange(), [params.range])
  const deferredQuery = useDeferredValue(params.query)
  const mode = params.mode as ExplorerMode
  const [isFilterPanelOpen, setFilterPanelOpen] = useState(true)
  const rangeBindings = useMemo(() => resolveTimeRangeBindings(range), [range])
  const defaultTaskColumns = ["task", "id", "last_updated", "state", "type", "worker", "runtime"]
  const defaultWorkflowColumns = [
    "workflow",
    "root_task_id",
    "last_updated",
    "aggregate_state",
    "root_task_type",
    "task_count",
    "worker_count",
  ]
  const visibleColumns =
    mode === "tasks"
      ? params.taskColumns.length > 0
        ? params.taskColumns
        : defaultTaskColumns
      : params.workflowColumns.length > 0
        ? params.workflowColumns
        : defaultWorkflowColumns

  const { tasks, workflows, total, histogram, filters, isLoading, isFetching, updatedAt, refetch } = useExplorerData({
    mode,
    range,
    rangeKey: params.range,
    query: deferredQuery,
    states: params.states,
    types: params.types,
    workers: params.workers,
    workflowStates: params.workflowStates,
    rootTypes: params.rootTypes,
    sortField: params.sortField,
    sortDirection: params.sortDirection,
    pageCount: params.pageCount,
  })
  const isLive = isLiveTimeRange(range)
  const chartSeries = useMemo(
    () => [
      { key: "pending", label: "Pending", color: "var(--status-neutral)", states: ["PENDING", "RECEIVED"] },
      { key: "running", label: "Running", color: "var(--status-info)", states: ["STARTED"] },
      { key: "retry", label: "Retry", color: "var(--status-warning)", states: ["RETRY"] },
      { key: "success", label: "Success", color: "var(--status-success)", states: ["SUCCESS"] },
      {
        key: "error",
        label: "Error",
        color: "var(--status-danger)",
        states: ["FAILURE", "REVOKED", "REJECTED", "IGNORED"],
      },
    ],
    [],
  )

  const setTaskFilter = (key: "states" | "types" | "workers" | "workflowStates" | "rootTypes", values: Set<string>) => {
    startTransition(() => {
      void setParams({ [key]: [...values], pageCount: 1 }, { history: "replace" })
    })
  }

  const exportCurrentRows = () => {
    const rows = mode === "tasks" ? tasks : workflows.map((workflow) => ({ ...workflow, id: workflow.root_task_id }))
    downloadFile(JSON.stringify(rows, null, 2), `${mode}.json`, "application/json")
  }
  const downloadCurrentCsv = useCallback(async () => {
    const { from, to } = resolveTimeRangeBindings(range)
    await downloadServerCsvExport(
      {
        kind: "explorer",
        mode,
        from,
        to,
        query: deferredQuery,
        states: params.states,
        types: params.types,
        workers: params.workers,
        workflowStates: params.workflowStates,
        rootTypes: params.rootTypes,
        sortField: params.sortField,
        sortDirection: params.sortDirection,
      },
      `${mode}.csv`,
    )
  }, [
    deferredQuery,
    mode,
    params.rootTypes,
    params.sortDirection,
    params.sortField,
    params.states,
    params.types,
    params.workflowStates,
    params.workers,
    range,
  ])

  useTourChangeStepOnLoad(11)

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[18rem] flex-1 sm:max-w-[28rem]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={params.query}
            onChange={(event) =>
              startTransition(() => {
                void setParams({ query: event.target.value, pageCount: 1 }, { history: "replace" })
              })
            }
            className="pl-9"
            placeholder={mode === "tasks" ? "Search tasks, workers, errors…" : "Search root task IDs and workflows…"}
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center rounded-md border bg-background shadow-xs">
            {[
              { value: "tasks", label: "Tasks", icon: Workflow },
              { value: "workflows", label: "Workflows", icon: GitBranch },
            ].map((item) => {
              const Icon = item.icon
              const active = mode === item.value
              return (
                <Tooltip key={item.value}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`${item.label} view`}
                      aria-pressed={active}
                      className={cn(
                        "rounded-none first:rounded-l-md last:rounded-r-md",
                        active ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                      )}
                      onClick={() =>
                        startTransition(() => {
                          void setParams(
                            {
                              mode: item.value as ExplorerMode,
                              pageCount: 1,
                              sortField: "last_updated",
                              sortDirection: "DESC",
                            },
                            { history: "push" },
                          )
                        })
                      }
                    >
                      <Icon className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{item.label}</TooltipContent>
                </Tooltip>
              )
            })}
          </div>
          <AppTimeRangePicker
            value={range}
            onChange={(nextRange) =>
              startTransition(() => {
                void setParams(
                  { range: serializeTimeRange(nextRange ?? createDefaultTimeRange()), pageCount: 1 },
                  { history: "push" },
                )
              })
            }
            className="w-full sm:w-[22rem]"
          />
          <LiveRefreshButton
            isLive={isLive}
            isFetching={isFetching}
            updatedAt={updatedAt}
            onRefresh={() => void refetch()}
            label="Refresh explorer data"
          />
        </div>
      </div>

      <ExplorerActivityChart
        data={histogram}
        isLoading={isLoading}
        emptyLabel={`No ${mode} in the selected range`}
        rangeStart={rangeBindings.from}
        rangeEnd={rangeBindings.to}
        series={chartSeries}
        onSelectRange={({ start, end }) => {
          const nextRange = createStaticTimeRange(new Date(start), new Date(end))
          if (!nextRange) return

          startTransition(() => {
            void setParams({ range: serializeTimeRange(nextRange), pageCount: 1 }, { history: "push" })
          })
        }}
      />

      <div className="flex flex-col gap-4 xl:flex-row">
        {isFilterPanelOpen ? (
          <div id="filters-panel" className="w-full xl:w-[320px] xl:shrink-0">
            <div className="space-y-1 pt-1">
              {mode === "tasks" ? (
                <>
                  <FilterSection
                    title="Status"
                    counts={new Map(Object.entries(filters.state))}
                    selected={new Set(params.states)}
                    setSelected={(values) => setTaskFilter("states", values)}
                  />
                  <FilterSection
                    title="Type"
                    counts={new Map(Object.entries(filters.type))}
                    selected={new Set(params.types)}
                    setSelected={(values) => setTaskFilter("types", values)}
                  />
                  <FilterSection
                    title="Worker"
                    counts={new Map(Object.entries(filters.worker))}
                    selected={new Set(params.workers)}
                    setSelected={(values) => setTaskFilter("workers", values)}
                  />
                </>
              ) : (
                <>
                  <FilterSection
                    title="Workflow State"
                    counts={new Map(Object.entries(filters.aggregate_state))}
                    selected={new Set(params.workflowStates)}
                    setSelected={(values) => setTaskFilter("workflowStates", values)}
                  />
                  <FilterSection
                    title="Root Task Type"
                    counts={new Map(Object.entries(filters.root_task_type))}
                    selected={new Set(params.rootTypes)}
                    setSelected={(values) => setTaskFilter("rootTypes", values)}
                  />
                </>
              )}
            </div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <ExplorerResultsTable
            mode={mode}
            tasks={tasks}
            workflows={workflows}
            visibleColumns={visibleColumns}
            setVisibleColumns={(columns) =>
              startTransition(() => {
                void setParams(mode === "tasks" ? { taskColumns: columns } : { workflowColumns: columns }, {
                  history: "replace",
                })
              })
            }
            sortField={params.sortField}
            sortDirection={params.sortDirection}
            onSortChange={(field) =>
              startTransition(() => {
                void setParams(
                  {
                    sortField: field,
                    sortDirection: params.sortField === field && params.sortDirection === "ASC" ? "DESC" : "ASC",
                  },
                  { history: "replace" },
                )
              })
            }
            onLoadMore={() =>
              startTransition(() => {
                void setParams({ pageCount: params.pageCount + 1 }, { history: "replace" })
              })
            }
            hasMore={(mode === "tasks" ? tasks.length : workflows.length) < total}
            isLoading={isLoading}
            toolbarStart={
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilterPanelOpen((open) => !open)}
                    aria-label={isFilterPanelOpen ? "Hide filters" : "Show filters"}
                  >
                    {isFilterPanelOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isFilterPanelOpen ? "Hide filters" : "Show filters"}</TooltipContent>
              </Tooltip>
            }
            toolbarEnd={
              <>
                <CopyLinkButton variant="outline" size="sm" aria-label="Copy link" />
                <DownloadMenuButton
                  label="Download data"
                  disabled={total === 0}
                  items={[
                    { label: "Download JSON", icon: FileJson, onSelect: exportCurrentRows },
                    { label: "Download CSV", icon: FileSpreadsheet, onSelect: () => void downloadCurrentCsv() },
                  ]}
                />
              </>
            }
          />
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute("/explorer")({
  component: ExplorerPage,
})
