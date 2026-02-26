import type { SurrealTask } from "@/types/surreal-records"
import { extractId } from "@/types/surreal-records"

/** Fields included in CSV export, in order */
const CSV_FIELDS = [
    "id",
    "type",
    "state",
    "worker",
    "sent_at",
    "received_at",
    "started_at",
    "succeeded_at",
    "failed_at",
    "retried_at",
    "revoked_at",
    "rejected_at",
    "runtime",
    "last_updated",
    "args",
    "kwargs",
    "eta",
    "expires",
    "retries",
    "exchange",
    "routing_key",
    "root_id",
    "parent_id",
    "children",
    "result",
    "result_truncated",
    "exception",
    "traceback",
] as const

function escapeCsvValue(value: unknown): string {
    if (value === null || value === undefined) return ""
    const str = String(value)
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`
    }
    return str
}

function taskToCsvRow(task: SurrealTask): string {
    return CSV_FIELDS.map((field) => {
        if (field === "id") return escapeCsvValue(extractId(task.id))
        if (field === "children") return escapeCsvValue(task.children?.join(";") ?? "")
        return escapeCsvValue((task as Record<string, unknown>)[field])
    }).join(",")
}

/** Convert tasks to CSV string */
export function tasksToCsv(tasks: SurrealTask[]): string {
    const header = CSV_FIELDS.join(",")
    const rows = tasks.map(taskToCsvRow)
    return [header, ...rows].join("\n")
}

/** Convert tasks to JSON string (with extracted IDs) */
export function tasksToJson(tasks: SurrealTask[]): string {
    const cleaned = tasks.map((task) => ({
        ...task,
        id: extractId(task.id),
    }))
    return JSON.stringify(cleaned, null, 2)
}

/** Trigger a file download in the browser */
export function downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
}

function formatTimestamp(): string {
    const now = new Date()
    return now.toISOString().replace(/[:.]/g, "-").slice(0, 19)
}

/** Export tasks as CSV file */
export function exportTasksCsv(tasks: SurrealTask[]) {
    const csv = tasksToCsv(tasks)
    downloadFile(csv, `tasks_${formatTimestamp()}.csv`, "text/csv;charset=utf-8")
}

/** Export tasks as JSON file */
export function exportTasksJson(tasks: SurrealTask[]) {
    const json = tasksToJson(tasks)
    downloadFile(json, `tasks_${formatTimestamp()}.json`, "application/json")
}
