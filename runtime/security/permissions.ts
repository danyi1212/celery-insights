import { HttpError as AuthError } from "../http-error"
export { HttpError as AuthError } from "../http-error"

export const permissions = [
  "task.metadata.read",
  "task.input.read",
  "task.result.read",
  "task.failure.read",
  "event.raw.read",
  "worker.metadata.read",
  "worker.inspect.read",
  "analytics.read",
  "task.export",
  "backup.export",
  "backup.import",
  "history.clear",
  "retention.update",
  "cleanup.run",
  "diagnostics.export",
  "diagnostics.secrets.export",
  "metrics.read",
] as const
export type Permission = (typeof permissions)[number]
export type Role = "viewer" | "operator" | "administrator"
export interface Principal {
  account_id: string
  roles: Role[]
}
const viewer: Permission[] = ["task.metadata.read", "worker.metadata.read", "analytics.read"]
export function grants(principal: Principal): Set<Permission> {
  return new Set(
    principal.roles.flatMap((role) =>
      role === "administrator"
        ? [...permissions]
        : role === "operator"
          ? [...viewer, "retention.update" as const, "cleanup.run" as const]
          : viewer,
    ),
  )
}
export function authorize(principal: Principal, actions: readonly Permission[], replay = false): void {
  const allowed = grants(principal)
  for (const action of actions) {
    if (
      !allowed.has(action) ||
      action === "diagnostics.secrets.export" ||
      (replay && ["backup.import", "history.clear", "retention.update", "cleanup.run"].includes(action))
    )
      throw new AuthError(403, "Access denied")
  }
}
export const payloadPermissions: Permission[] = [
  "task.metadata.read",
  "task.input.read",
  "task.result.read",
  "task.failure.read",
  "event.raw.read",
  "worker.metadata.read",
  "worker.inspect.read",
]
export const routePermissions: Record<string, Permission[]> = {
  "GET /api/config": ["task.metadata.read"],
  "GET /api/settings/info": ["diagnostics.export"],
  "GET /api/settings/debug-snapshot": ["diagnostics.export"],
  "POST /api/settings/download-debug-bundle": ["diagnostics.export", "backup.export", ...payloadPermissions],
  "POST /api/settings/clear": ["history.clear"],
  "GET /api/settings/export": ["backup.export", ...payloadPermissions],
  "POST /api/settings/import": ["backup.import"],
  "GET /api/settings/retention": ["analytics.read"],
  "PUT /api/settings/retention": ["retention.update", "analytics.read"],
  "POST /api/settings/cleanup": ["cleanup.run", "analytics.read"],
  "GET /metrics": ["metrics.read"],
  "GET /metrics/verbose": ["metrics.read", "task.metadata.read", "worker.metadata.read", "task.failure.read"],
  "GET /metrics/system": ["metrics.read"],
  "POST /api/exports/csv": ["task.export", ...payloadPermissions],
}
