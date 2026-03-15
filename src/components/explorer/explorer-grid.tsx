import TaskAvatar from "@components/task/task-avatar"
import { Button } from "@components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@components/ui/table"
import { useExplorerColumns } from "@stores/use-explorer-config"
import { TaskState, extractId } from "@/types/surreal-records"
import type { SurrealTask } from "@/types/surreal-records"
import type { SortConfig } from "@hooks/use-explorer-tasks"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"
import React, { useMemo } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown } from "lucide-react"

interface ExplorerGridProps {
  tasks: SurrealTask[]
  sort: SortConfig
  setSort: (sort: SortConfig) => void
  page: number
  setPage: (page: number) => void
  pageSize: number
  total: number
}

const SURREAL_FIELD_MAP: Record<string, string> = {
  lastUpdated: "last_updated",
  state: "state",
  id: "id",
  type: "type",
  result: "result",
  worker: "worker",
}

const ExplorerGrid: React.FC<ExplorerGridProps> = ({ tasks, sort, setSort, page, setPage, pageSize, total }) => {
  const columnConfigs = useExplorerColumns()
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const columns: ColumnDef<SurrealTask>[] = useMemo(
    () => [
      {
        id: "avatar",
        header: "Task",
        size: 60,
        enableSorting: false,
        cell: ({ row }) => {
          const taskId = extractId(row.original.id)
          return (
            <div className="flex items-center justify-center">
              <TaskAvatar taskId={taskId} type={row.original.type} status={row.original.state as TaskState} />
            </div>
          )
        },
      },
      ...columnConfigs.map(
        (columnConfig): ColumnDef<SurrealTask> => ({
          id: columnConfig.property as string,
          accessorFn: (row) => {
            const surrealField = SURREAL_FIELD_MAP[columnConfig.property as string] || columnConfig.property
            return (row as unknown as Record<string, unknown>)[surrealField as string]
          },
          header: columnConfig.label,
          size: columnConfig.columnWidth,
          cell: ({ getValue }) => {
            const value = getValue()
            if (columnConfig.property === "last_updated" && typeof value === "string") {
              const date = new Date(value)
              return Number.isNaN(date.getTime()) ? "NaT" : date.toLocaleString()
            }
            return columnConfig.valueFormatter ? columnConfig.valueFormatter(value as never) : (value as string)
          },
        }),
      ),
    ],
    [columnConfigs],
  )

  const handleSort = (columnId: string) => {
    const surrealField = SURREAL_FIELD_MAP[columnId] || columnId
    if (sort.field === surrealField) {
      setSort({ field: surrealField, direction: sort.direction === "ASC" ? "DESC" : "ASC" })
    } else {
      setSort({ field: surrealField, direction: "DESC" })
    }
  }

  const table = useReactTable({
    data: tasks,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => extractId(row.id),
    manualSorting: true,
  })

  return (
    <div>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.id !== "avatar"
                const surrealField = SURREAL_FIELD_MAP[header.id] || header.id
                const isSorted = sort.field === surrealField
                return (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className={canSort ? "cursor-pointer select-none" : ""}
                    onClick={() => canSort && handleSort(header.id)}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort &&
                        (isSorted && sort.direction === "ASC" ? (
                          <ChevronUp className="size-4" />
                        ) : isSorted && sort.direction === "DESC" ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
                        ))}
                    </div>
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                No tasks found.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-4">
          <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

export default ExplorerGrid
