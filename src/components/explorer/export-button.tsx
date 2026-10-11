import { usePermissions } from "@hooks/use-permissions"
import type { ReadRequest } from "../../../runtime/observation/queries"
import { queryObservation } from "@lib/observation-query"
import { Button } from "@components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useSurrealDB } from "@components/surrealdb-provider"
import type { ExplorerFilters, SortConfig } from "@hooks/use-explorer-tasks"
import type { SurrealTask } from "@/types/surreal-records"
import { exportTasksCsv, exportTasksJson } from "@lib/export-tasks"
import { Download, FileJson, FileSpreadsheet, Loader2 } from "lucide-react"
import React, { useCallback, useId, useState } from "react"

interface ExportButtonProps {
  filters: ExplorerFilters
  sort: SortConfig
  total: number
}

function buildWhereClause(filters: ExplorerFilters): { clause: string; bindings: Record<string, unknown> } {
  const conditions: string[] = []
  const bindings: Record<string, unknown> = {}

  if (filters.states && filters.states.length > 0) {
    conditions.push("state IN $states")
    bindings.states = filters.states
  }
  if (filters.types && filters.types.length > 0) {
    conditions.push("type IN $types")
    bindings.types = filters.types
  }
  if (filters.workers && filters.workers.length > 0) {
    conditions.push("worker IN $workers")
    bindings.workers = filters.workers
  }

  const clause = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : ""
  return { clause, bindings }
}

const ExportButton: React.FC<ExportButtonProps> = ({ filters, sort, total }) => {
  const hintId = useId()
  const { can } = usePermissions()
  const { db } = useSurrealDB()
  const [error, setError] = useState("")
  const [isExporting, setIsExporting] = useState(false)

  const fetchAllFilteredTasks = useCallback(async (): Promise<SurrealTask[]> => {
    const { clause, bindings } = buildWhereClause(filters)
    const query = `SELECT * FROM task${clause} ORDER BY ${sort.field} ${sort.direction}`
    const [result] = await queryObservation<[SurrealTask[]]>(
      db,
      {
        operation: "export",
        ...filters,
        sortField: sort.field as ReadRequest["sortField"],
        sortDirection: sort.direction === "ASC" ? "ASC" : "DESC",
        limit: 10000,
      },
      query,
      bindings,
    )
    return Array.isArray(result) ? result : []
  }, [db, filters, sort])

  const handleExport = useCallback(
    async (format: "csv" | "json") => {
      setError("")
      setIsExporting(true)
      try {
        const tasks = await fetchAllFilteredTasks()
        if (format === "csv") {
          exportTasksCsv(tasks)
        } else {
          exportTasksJson(tasks)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to export tasks. Please try again.")
      } finally {
        setIsExporting(false)
      }
    },
    [fetchAllFilteredTasks],
  )

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Export tasks"
                  aria-describedby={!can("task.export") ? hintId : undefined}
                  disabled={!can("task.export") || isExporting || total === 0}
                >
                  {isExporting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4 text-muted-foreground" />
                  )}
                </Button>
              </DropdownMenuTrigger>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {can("task.export") ? `Export ${total} tasks` : "Your account cannot export tasks"}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleExport("csv")}>
            <FileSpreadsheet className="size-4" />
            Export as CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport("json")}>
            <FileJson className="size-4" />
            Export as JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {!can("task.export") && (
        <span id={hintId} className="sr-only">
          Your account cannot export tasks.
        </span>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </>
  )
}

export default ExportButton
