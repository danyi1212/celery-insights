import { DataGrid, GridColDef } from "@mui/x-data-grid"
import { StateTask } from "@utils/translateServerModels"
import { format } from "date-fns"
import React from "react"

const columns: GridColDef[] = [
    {
        field: "lastUpdated",
        headerName: "Last Updated",
        minWidth: 160,
        valueFormatter: (params) => format(params.value, "MMM dd  hh:mm:ss.SSS"),
    },
    { field: "id", headerName: "Task ID", width: 100 },
    { field: "type", headerName: "Task Type", width: 300 },
]

interface ExplorerGridProps {
    tasks: StateTask[]
}

const ExplorerGrid: React.FC<ExplorerGridProps> = ({ tasks }) => {
    return (
        <DataGrid
            columns={columns}
            rows={tasks}
            initialState={{ sorting: { sortModel: [{ field: "lastUpdated", sort: "desc" }] } }}
            autoHeight
        />
    )
}

export default ExplorerGrid
