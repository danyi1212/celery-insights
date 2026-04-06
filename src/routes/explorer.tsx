import { createFileRoute } from "@tanstack/react-router"
import LiveRefreshButton from "@components/common/live-refresh-button"
import AppTimeRangePicker from "@components/common/time-range-picker"
import ExplorerActivityChart from "@components/explorer/explorer-activity-chart"
import ExplorerResultsTable from "@components/explorer/explorer-results-table"
import Facet from "@components/explorer/facet"
import { Button } from "@components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { Input } from "@components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useExplorerData, type ExplorerMode } from "@hooks/use-explorer-data"
import {
  createDefaultTimeRange,
  deserializeTimeRange,
  resolveTimeRangeBindings,
  serializeTimeRange,
} from "@lib/time-range-utils"
import { useTourChangeStepOnLoad } from "@stores/use-tour-store"
import { Download, GitBranch, PanelLeftClose, PanelLeftOpen, Search, Share2, Workflow } from "lucide-react"
import { parseAsArrayOf, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { isLiveTimeRange } from "@danyi1212/time-range-picker/time-range"
import { downloadFile } from "@lib/export-tasks"
import { startTransition, useCallback, useDeferredValue, useMemo, useState } from "react"

const ExplorerPage = () => {
  const [params, setParams] = useQueryStates({
    mode: parseAsStringLiteral(["tasks", "workflows"] as const).withDefault("tasks"),
    range: parseAsString.withDefault("24h"),
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
  const [isFacetMenuOpen, setFacetMenuOpen] = useState(true)
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

  const { tasks, workflows, total, histogram, facets, isLoading, isFetching, updatedAt, refetch } = useExplorerData({
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

  const setTaskFacet = (key: "states" | "types" | "workers" | "workflowStates" | "rootTypes", values: Set<string>) => {
    startTransition(() => {
      void setParams({ [key]: [...values], pageCount: 1 }, { history: "replace" })
    })
  }

  const exportCurrentRows = () => {
    const rows = mode === "tasks" ? tasks : workflows.map((workflow) => ({ ...workflow, id: workflow.root_task_id }))
    downloadFile(JSON.stringify(rows, null, 2), `${mode}.json`, "application/json")
  }

  const copyCurrentLocation = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href)
  }, [])

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
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(value) =>
              value &&
              startTransition(() => {
                void setParams(
                  {
                    mode: value as ExplorerMode,
                    pageCount: 1,
                    sortField: "last_updated",
                    sortDirection: "DESC",
                  },
                  { history: "push" },
                )
              })
            }
            variant="outline"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem value="tasks" aria-label="Tasks view" className="px-2">
                  <Workflow className="size-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Tasks</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem value="workflows" aria-label="Workflows view" className="px-2">
                  <GitBranch className="size-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Workflows</TooltipContent>
            </Tooltip>
          </ToggleGroup>
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
      />

      <div className="flex flex-col gap-4 xl:flex-row">
        {isFacetMenuOpen ? (
          <div id="facets-menu" className="w-full xl:w-[320px] xl:shrink-0">
            <div className="space-y-1 pt-1">
              {mode === "tasks" ? (
                <>
                  <Facet
                    title="Status"
                    counts={new Map(Object.entries(facets.state))}
                    selected={new Set(params.states)}
                    setSelected={(values) => setTaskFacet("states", values)}
                  />
                  <Facet
                    title="Type"
                    counts={new Map(Object.entries(facets.type))}
                    selected={new Set(params.types)}
                    setSelected={(values) => setTaskFacet("types", values)}
                  />
                  <Facet
                    title="Worker"
                    counts={new Map(Object.entries(facets.worker))}
                    selected={new Set(params.workers)}
                    setSelected={(values) => setTaskFacet("workers", values)}
                  />
                </>
              ) : (
                <>
                  <Facet
                    title="Workflow State"
                    counts={new Map(Object.entries(facets.aggregate_state))}
                    selected={new Set(params.workflowStates)}
                    setSelected={(values) => setTaskFacet("workflowStates", values)}
                  />
                  <Facet
                    title="Root Task Type"
                    counts={new Map(Object.entries(facets.root_task_type))}
                    selected={new Set(params.rootTypes)}
                    setSelected={(values) => setTaskFacet("rootTypes", values)}
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
                    onClick={() => setFacetMenuOpen((open) => !open)}
                    aria-label={isFacetMenuOpen ? "Hide facets" : "Show facets"}
                  >
                    {isFacetMenuOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isFacetMenuOpen ? "Hide facets" : "Show facets"}</TooltipContent>
              </Tooltip>
            }
            toolbarEnd={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" aria-label="Share options">
                    <Share2 className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Share</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void copyCurrentLocation()}>
                    <Share2 className="size-4" />
                    Copy link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportCurrentRows}>
                    <Download className="size-4" />
                    Download JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
