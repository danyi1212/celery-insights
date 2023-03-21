import { DataGrid, GridColDef } from "@mui/x-data-grid"
import { useExplorerColumns } from "@stores/useExplorerConfig"
import { StateTask } from "@utils/translateServerModels"
import React, { useMemo } from "react"

interface ExplorerGridProps {
    tasks: StateTask[]
}


const ExplorerGrid: React.FC<ExplorerGridProps> = ({ tasks }) => {
    const columnConfigs = useExplorerColumns()
    const columnDefs: GridColDef[] = useMemo(
        () =>
            columnConfigs.map((columnConfig) => ({
                field: columnConfig.property,
                headerName: columnConfig.label,
                minWidth: columnConfig.columnWidth,
                valueFormatter: (params) =>
                    columnConfig.valueFormatter ? columnConfig.valueFormatter(params.value as never) : params.value,
            })),
        [columnConfigs]
    )

    return (
        <DataGrid
            columns={columnDefs}
            rows={tasks}
            initialState={{ sorting: { sortModel: [{ field: "lastUpdated", sort: "desc" }] } }}
            autoHeight
        />
    )
}

export default ExplorerGrid
