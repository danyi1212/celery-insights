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

export interface DebugSnapshotDetails {
    enabled: boolean
    readOnly: boolean
    bundlePath: string
    manifest: {
        format: string
        version: number
        source: {
            createdAt: string
            redacted: boolean
            recordCounts: { tasks: number; events: number; workers: number }
        }
        replay?: {
            createdAt: string
            redacted: boolean
            recordCounts: { tasks: number; events: number; workers: number }
        }
    }
    sourceConfig: Record<string, unknown>
    sourceRuntime: Record<string, unknown>
    sourceRetention: Record<string, unknown> | null
    sourceVersions: Record<string, unknown> | null
    sourceHealth: Record<string, unknown> | null
    sourceUi: Record<string, unknown>
    sourceLogs: {
        bun: string
        python: string
        surrealdb: string
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

export const fetchDebugSnapshotDetails = async (): Promise<DebugSnapshotDetails> => {
    const res = await fetch("/api/settings/debug-snapshot")
    if (!res.ok) throw new Error(`Debug snapshot request failed: ${res.status}`)
    return res.json()
}

export const useDebugSnapshotDetails = ({ enabled = true }: { enabled?: boolean } = {}) =>
    useQuery({
        queryKey: ["debug-snapshot-details", enabled ? "active" : "inactive"],
        queryFn: fetchDebugSnapshotDetails,
        staleTime: 5_000,
        enabled,
    })
