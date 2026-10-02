import { downloadFile } from "@lib/export-tasks"

interface ExplorerExportPayload {
  kind: "explorer"
  mode: "tasks" | "workflows"
  from: string
  to: string
  query: string
  states?: string[]
  types?: string[]
  workers?: string[]
  workflowStates?: string[]
  rootTypes?: string[]
  sortField: string
  sortDirection: "ASC" | "DESC"
}

interface RawEventsExportPayload {
  kind: "raw-events"
  from: string
  to: string
  query: string
  types?: string[]
}

export async function downloadServerCsvExport(
  payload: ExplorerExportPayload | RawEventsExportPayload,
  filename: string,
) {
  const response = await fetch("/api/exports/csv", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`CSV export failed (${response.status})`)
  }

  const content = await response.text()
  downloadFile(content, filename, "text/csv;charset=utf-8")
}
