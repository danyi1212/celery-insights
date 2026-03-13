import { useQuery } from "@tanstack/react-query"

export interface SettingsDiagnostics {
    cpu_usage: [number, number, number]
    memory_usage: number
    uptime: number
    server_hostname: string
    server_port: number
    server_version: string
    server_os: string
    server_name: string
    python_version: string
    task_count: number
    worker_count: number
    event_count: number
    timezone: string
    surrealdb: {
        endpoint: string
        namespace: string
        database: string
        topology: string
        storage: string | null
        durability: string
    }
    ingestion: {
        batch_interval_ms: number
        queue_size: number
        buffer_size: number
        dropped_events: number
        events_ingested_total: number
        flushes_total: number
    }
}

export const fetchSettingsDiagnostics = async (): Promise<SettingsDiagnostics> => {
    const res = await fetch("/api/settings/info")
    if (!res.ok) throw new Error(`Server info request failed: ${res.status}`)
    return res.json()
}

export const useSettingsDiagnostics = ({ enabled = true }: { enabled?: boolean } = {}) =>
    useQuery({
        queryKey: ["settings-info", enabled ? "live" : "demo"],
        queryFn: fetchSettingsDiagnostics,
        staleTime: 1_000,
        enabled,
    })
