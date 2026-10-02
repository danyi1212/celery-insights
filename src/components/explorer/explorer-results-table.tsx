import TaskAvatar from "@components/task/task-avatar"
import { Button } from "@components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@components/ui/table"
import type { ExplorerMode } from "@hooks/use-explorer-data"
import { formatSecondsDuration } from "@utils/format-seconds-duration"
import { extractId, TaskState, type SurrealTask, type SurrealWorkflow } from "@/types/surreal-records"
import { Link as RouterLink } from "@tanstack/react-router"
import { ChevronDown, ChevronUp, ChevronsUpDown, Settings2 } from "lucide-react"

type SortDirection = "ASC" | "DESC"

interface ExplorerResultsTableProps {
  mode: ExplorerMode
  tasks: SurrealTask[]
  workflows: SurrealWorkflow[]
  visibleColumns: string[]
  setVisibleColumns: (columns: string[]) => void
  sortField: string
  sortDirection: SortDirection
  onSortChange: (field: string) => void
  onLoadMore: () => void
  hasMore: boolean
  isLoading: boolean
  toolbarStart?: React.ReactNode
  toolbarEnd?: React.ReactNode
}

interface ColumnDef<Row> {
  key: string
  label: string
  sortable?: boolean
  render: (row: Row) => React.ReactNode
}

const renderText = (value: unknown, fallback = "Unknown") => {
  if (value === null || value === undefined || value === "") {
    return fallback
  }

  return typeof value === "string" ? value : String(value)
}

const renderDateTime = (value: unknown, fallback = "Unknown") => {
  if (value === null || value === undefined || value === "") {
    return fallback
  }

  const date = new Date(typeof value === "string" ? value : String(value))
  return Number.isNaN(date.getTime()) ? renderText(value, fallback) : date.toLocaleString()
}

const taskColumns: ColumnDef<SurrealTask>[] = [
  {
    key: "task",
    label: "Task",
    render: (task) => (
      <TaskAvatar taskId={extractId(task.id)} type={task.type} status={task.state as TaskState} className="size-9" />
    ),
  },
  {
    key: "id",
    label: "Task ID",
    render: (task) => (
      <RouterLink to="/tasks/$taskId" params={{ taskId: extractId(task.id) }} className="font-medium hover:underline">
        {extractId(task.id)}
      </RouterLink>
    ),
  },
  {
    key: "last_updated",
    label: "Updated",
    sortable: true,
    render: (task) => new Date(task.last_updated).toLocaleString(),
  },
  { key: "state", label: "State", sortable: true, render: (task) => task.state },
  { key: "type", label: "Type", sortable: true, render: (task) => task.type || "Unknown" },
  { key: "worker", label: "Worker", sortable: true, render: (task) => task.worker || "Unassigned" },
  { key: "runtime", label: "Runtime", sortable: true, render: (task) => formatSecondsDuration(task.runtime || 0) },
  { key: "workflow_id", label: "Workflow", render: (task) => task.workflow_id || task.root_id || extractId(task.id) },
]

const getWorkflowRootTaskId = (workflow: SurrealWorkflow) => extractId(workflow.root_task_id)

const workflowColumns: ColumnDef<SurrealWorkflow>[] = [
  {
    key: "workflow",
    label: "Workflow",
    render: (workflow) => (
      <TaskAvatar
        taskId={getWorkflowRootTaskId(workflow)}
        type={workflow.root_task_type}
        status={workflow.aggregate_state as TaskState}
        className="size-9"
      />
    ),
  },
  {
    key: "root_task_id",
    label: "Root Task",
    render: (workflow) => (
      <RouterLink
        to="/tasks/$taskId"
        params={{ taskId: getWorkflowRootTaskId(workflow) }}
        className="font-medium hover:underline"
      >
        {getWorkflowRootTaskId(workflow)}
      </RouterLink>
    ),
  },
  {
    key: "last_updated",
    label: "Updated",
    sortable: true,
    render: (workflow) => renderDateTime(workflow.last_updated),
  },
  {
    key: "aggregate_state",
    label: "State",
    sortable: true,
    render: (workflow) => renderText(workflow.aggregate_state),
  },
  {
    key: "root_task_type",
    label: "Root Type",
    sortable: true,
    render: (workflow) => renderText(workflow.root_task_type),
  },
  { key: "task_count", label: "Tasks", sortable: true, render: (workflow) => renderText(workflow.task_count, "0") },
  {
    key: "failure_count",
    label: "Failures",
    sortable: true,
    render: (workflow) => renderText(workflow.failure_count, "0"),
  },
  {
    key: "active_count",
    label: "Active",
    sortable: true,
    render: (workflow) => renderText(workflow.active_count, "0"),
  },
  {
    key: "worker_count",
    label: "Workers",
    sortable: true,
    render: (workflow) => renderText(workflow.worker_count, "0"),
  },
]

const renderSortIcon = (isSorted: boolean, direction: SortDirection) => {
  if (!isSorted) return <ChevronsUpDown className="size-3.5 text-muted-foreground" />
  return direction === "ASC" ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />
}

const ExplorerResultsTable = ({
  mode,
  tasks,
  workflows,
  visibleColumns,
  setVisibleColumns,
  sortField,
  sortDirection,
  onSortChange,
  onLoadMore,
  hasMore,
  isLoading,
  toolbarStart,
  toolbarEnd,
}: ExplorerResultsTableProps) => {
  const columnDefs = mode === "tasks" ? taskColumns : workflowColumns
  const rows = mode === "tasks" ? tasks : workflows
  const visible = columnDefs.filter((column) => visibleColumns.includes(column.key))
  const visibleTaskColumns = taskColumns.filter((column) => visibleColumns.includes(column.key))
  const visibleWorkflowColumns = workflowColumns.filter((column) => visibleColumns.includes(column.key))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">{toolbarStart}</div>
        <div className="flex items-center gap-2">
          {toolbarEnd}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="mr-2 size-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columnDefs.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={visibleColumns.includes(column.key)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setVisibleColumns([...visibleColumns, column.key])
                      return
                    }
                    setVisibleColumns(visibleColumns.filter((key) => key !== column.key))
                  }}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {visible.map((column) => {
              const isSorted = sortField === column.key
              return (
                <TableHead
                  key={column.key}
                  className={column.sortable ? "cursor-pointer select-none" : undefined}
                  onClick={() => column.sortable && onSortChange(column.key)}
                >
                  <div className="flex items-center gap-1">
                    {column.label}
                    {column.sortable ? renderSortIcon(isSorted, sortDirection) : null}
                  </div>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={visible.length || 1} className="h-24 text-center text-muted-foreground">
                {isLoading ? "Loading…" : `No ${mode} found.`}
              </TableCell>
            </TableRow>
          ) : mode === "tasks" ? (
            tasks.map((task) => (
              <TableRow key={extractId(task.id)}>
                {visibleTaskColumns.map((column) => (
                  <TableCell key={column.key}>{column.render(task)}</TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            workflows.map((workflow) => (
              <TableRow key={extractId(workflow.id)}>
                {visibleWorkflowColumns.map((column) => (
                  <TableCell key={column.key}>{column.render(workflow)}</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {hasMore ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={onLoadMore}>
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export default ExplorerResultsTable
