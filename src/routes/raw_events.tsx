import { appShortcuts } from "@components/keyboard/shortcut-definitions"
import { createFileRoute } from "@tanstack/react-router"
import CopyLinkButton from "@components/common/copy-link-button"
import DownloadMenuButton from "@components/common/download-menu-button"
import LiveRefreshButton from "@components/common/live-refresh-button"
import AppTimeRangePicker from "@components/common/time-range-picker"
import ExplorerActivityChart from "@components/explorer/explorer-activity-chart"
import Facet from "@components/explorer/facet"
import { RawEventsTable } from "@components/raw_events/raw-events-table"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useSurrealDB } from "@components/surrealdb-provider"
import { useEventsBrowser } from "@hooks/use-events-browser"
import { useKeyboardShortcuts } from "@hooks/use-keyboard-shortcuts"
import {
  createDefaultTimeRange,
  deserializeTimeRange,
  resolveTimeRangeBindings,
  serializeTimeRange,
} from "@lib/time-range-utils"
import { downloadFile } from "@lib/export-tasks"
import { downloadServerCsvExport } from "@lib/server-export"
import { FileJson, FileSpreadsheet, Loader2, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react"
import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from "nuqs"
import { isLiveTimeRange } from "@danyi1212/time-range-picker/time-range"
import { startTransition, useCallback, useDeferredValue, useMemo, useState } from "react"

const RawEventsPage = () => {
  const { status } = useSurrealDB()
  const [params, setParams] = useQueryStates({
    range: parseAsString.withDefault("1h"),
    query: parseAsString.withDefault(""),
    types: parseAsArrayOf(parseAsString).withDefault([]),
    pageCount: parseAsInteger.withDefault(1),
  })

  const range = useMemo(() => deserializeTimeRange(params.range) ?? createDefaultTimeRange(), [params.range])
  const deferredQuery = useDeferredValue(params.query)
  const [isFacetMenuOpen, setFacetMenuOpen] = useState(true)
  const rangeBindings = useMemo(() => resolveTimeRangeBindings(range), [range])
  const { events, total, eventTypes, histogram, isLoading, isFetching, updatedAt, refetch } = useEventsBrowser({
    range,
    rangeKey: params.range,
    query: deferredQuery,
    types: params.types,
    pageCount: params.pageCount,
  })
  const isLive = isLiveTimeRange(range)

  const shortcuts = useMemo(
    () => [
      {
        allowInInput: false,
        description: "Reset event filters",
        handler: () => void setParams({ query: "", types: [], pageCount: 1 }, { history: "replace" }),
        id: "reset-live-events-filters",
        section: "Current Page",
        sequence: appShortcuts.toggleLiveEventsConnection,
      },
    ],
    [setParams],
  )

  useKeyboardShortcuts(shortcuts)

  const exportCurrentRows = useCallback(() => {
    downloadFile(JSON.stringify(events, null, 2), "raw-events.json", "application/json")
  }, [events])
  const downloadCurrentCsv = useCallback(async () => {
    const { from, to } = resolveTimeRangeBindings(range)
    await downloadServerCsvExport(
      {
        kind: "raw-events",
        from,
        to,
        query: deferredQuery,
        types: params.types,
      },
      "raw-events.csv",
    )
  }, [deferredQuery, params.types, range])

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[18rem] flex-1 sm:max-w-[28rem]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={params.query}
            onChange={(event) =>
              startTransition(() => {
                void setParams({ query: event.target.value, pageCount: 1 }, { history: "replace" })
              })
            }
            placeholder="Search types, task IDs, hostnames…"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
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
            label="Refresh raw events"
          />
        </div>
      </div>

      <ExplorerActivityChart
        data={histogram}
        isLoading={isLoading}
        emptyLabel="No events in the selected range"
        rangeStart={rangeBindings.from}
        rangeEnd={rangeBindings.to}
      />

      <div className="flex flex-col gap-4 xl:flex-row">
        {isFacetMenuOpen ? (
          <div id="facets-menu" className="w-full xl:w-[320px] xl:shrink-0">
            <div className="space-y-1 pt-1">
              <Facet
                title="Event types"
                counts={new Map(Object.entries(eventTypes))}
                selected={new Set(params.types)}
                setSelected={(values) =>
                  startTransition(() => {
                    void setParams({ types: [...values], pageCount: 1 }, { history: "replace" })
                  })
                }
              />
            </div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
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
            </div>
            <div className="flex items-center gap-2">
              <CopyLinkButton variant="outline" size="sm" aria-label="Copy link" />
              <DownloadMenuButton
                label="Download data"
                disabled={total === 0}
                items={[
                  { label: "Download JSON", icon: FileJson, onSelect: exportCurrentRows },
                  { label: "Download CSV", icon: FileSpreadsheet, onSelect: () => void downloadCurrentCsv() },
                ]}
              />
            </div>
          </div>

          {status !== "connected" ? (
            <div className="my-10 flex items-center justify-center gap-3">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <h5 className="text-xl font-semibold">Connecting to event stream…</h5>
            </div>
          ) : (
            <>
              <RawEventsTable events={events} />
              {events.length < total ? (
                <div className="flex justify-center">
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
                    onClick={() =>
                      startTransition(() => {
                        void setParams({ pageCount: params.pageCount + 1 }, { history: "replace" })
                      })
                    }
                  >
                    Load more events
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute("/raw_events")({
  component: RawEventsPage,
})
