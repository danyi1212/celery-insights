import type { IngestionStatus } from "@components/surrealdb-provider"
import type { ConnectionStatus } from "surrealdb"

const connectionLabels: Record<ConnectionStatus, string> = {
    connected: "Connected",
    connecting: "Connecting",
    reconnecting: "Reconnecting",
    disconnected: "Disconnected",
}

const ingestionLabels: Record<IngestionStatus, string> = {
    leader: "Ingesting",
    standby: "Standby",
    "read-only": "Read-only",
    disabled: "Disabled",
}

export const formatConnectionStatus = (status: ConnectionStatus) => connectionLabels[status]

export const formatIngestionStatus = (status: IngestionStatus) => ingestionLabels[status]

export const formatTopology = (topology?: string) => {
    if (topology === "external") return "External"
    return "Embedded"
}

export const formatDurability = (durability?: string) => {
    if (durability === "persistent") return "Persistent disk"
    if (durability === "external") return "Managed externally"
    return "Ephemeral (memory)"
}

export const describeDurability = (durability?: string) => {
    if (durability === "persistent") return "History survives container restarts on this node."
    if (durability === "external") return "History is managed by the shared SurrealDB deployment."
    return "History disappears when this container restarts."
}

export const formatStorageEngine = (storage?: string | null) => storage || "Managed externally"

export const formatVersion = (version?: string | null) => {
    if (!version) return "—"
    return version.startsWith("v") ? version : `v${version}`
}
