import TaskAvatar from "@components/task/task-avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@components/ui/table"
import { TaskFilter } from "@hooks/explorer/use-explorer-filter"
import { useExplorerColumns } from "@stores/use-explorer-config"
import { StateTask } from "@utils/translate-server-models"
import {
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
    type ColumnDef,
    type SortingState,
} from "@tanstack/react-table"
import React, { useDeferredValue, useMemo, useState } from "react"
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react"

interface ExplorerGridProps {
    tasks: StateTask[]
    filters: TaskFilter<StateTask>
}

const ExplorerGrid: React.FC<ExplorerGridProps> = ({ tasks, filters }) => {
    const columnConfigs = useExplorerColumns()
    const [sorting, setSorting] = useState<SortingState>([{ id: "lastUpdated", desc: true }])

    const columns: ColumnDef<StateTask>[] = useMemo(
        () => [
            {
                id: "avatar",
                header: "Task",
                size: 60,
                enableSorting: false,
                cell: ({ row }) => (
                    <div className="flex items-center justify-center">
                        <TaskAvatar taskId={row.original.id} type={row.original.type} status={row.original.state} />
                    </div>
                ),
            },
            ...columnConfigs.map(
                (columnConfig): ColumnDef<StateTask> => ({
                    accessorKey: columnConfig.property,
                    header: columnConfig.label,
                    size: columnConfig.columnWidth,
                    cell: ({ getValue }) => {
                        const value = getValue()
                        return columnConfig.valueFormatter
                            ? columnConfig.valueFormatter(value as never)
                            : (value as string)
                    },
                }),
            ),
        ],
        [columnConfigs],
    )

    const deferredTasks = useDeferredValue(tasks)
    const filteredTasks = useMemo(
        () =>
            deferredTasks.filter((task) => {
                for (const [property, values] of filters) {
                    const value = task[property]?.toString()
                    if (values.size != 0 && value && !values.has(value)) return false
                }
                return true
            }),
        [deferredTasks, filters],
    )

    const table = useReactTable({
        data: filteredTasks,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getRowId: (row) => row.id,
    })

    return (
        <Table>
            <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                            <TableHead
                                key={header.id}
                                style={{ width: header.getSize() }}
                                className={header.column.getCanSort() ? "cursor-pointer select-none" : ""}
                                onClick={header.column.getToggleSortingHandler()}
                            >
                                <div className="flex items-center gap-1">
                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                    {header.column.getCanSort() &&
                                        (header.column.getIsSorted() === "asc" ? (
                                            <ChevronUp className="size-4" />
                                        ) : header.column.getIsSorted() === "desc" ? (
                                            <ChevronDown className="size-4" />
                                        ) : (
                                            <ChevronsUpDown className="size-3.5 text-muted-foreground" />
                                        ))}
                                </div>
                            </TableHead>
                        ))}
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
                                <TableCell key={cell.id}>
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    )
}

export default ExplorerGrid
