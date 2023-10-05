import TaskAvatar from "@components/task/TaskAvatar"
import { TaskFilter } from "@hooks/explorer/useExplorerFilter"
import Box from "@mui/material/Box"
import { DataGrid, GridColDef } from "@mui/x-data-grid"
import { useExplorerColumns } from "@stores/useExplorerConfig"
import { StateTask } from "@utils/translateServerModels"
import React, { useDeferredValue, useMemo } from "react"

interface ExplorerGridProps {
    tasks: StateTask[]
    filters: TaskFilter<StateTask>
}

const ExplorerGrid: React.FC<ExplorerGridProps> = ({ tasks, filters }) => {
    const columnConfigs = useExplorerColumns()
    const columnDefs: GridColDef[] = useMemo(
        () => [
            {
                field: "id",
                headerName: "Task",
                renderCell: (params) => (
                    <Box display="flex" alignItems="center" justifyContent="center" width="100%" height="100%">
                        <TaskAvatar taskId={params.row.id} type={params.row.type} status={params.row.state} />
                    </Box>
                ),
            },
            ...columnConfigs.map(
                (columnConfig): GridColDef => ({
                    field: columnConfig.property,
                    headerName: columnConfig.label,
                    minWidth: columnConfig.columnWidth,
                    valueFormatter: (params) =>
                        columnConfig.valueFormatter ? columnConfig.valueFormatter(params.value as never) : params.value,
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

    return (
        <DataGrid
            columns={columnDefs}
            rows={filteredTasks}
            initialState={{ sorting: { sortModel: [{ field: "lastUpdated", sort: "desc" }] } }}
            autoHeight
        />
    )
}

export default ExplorerGrid
