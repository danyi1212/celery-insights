import os from "node:os"
import { trimQuery } from "../src/lib/task-search"
import { buildIndexedTaskSearch, buildIndexedWorkflowSearch } from "../src/lib/indexed-search"
import { Gauge, Histogram, Registry } from "prom-client"
import { RecordId, type Surreal } from "surrealdb"
import { z } from "zod"
import { planWorkflowBackfill } from "./surreal-schema"
import type { Config } from "./config"
import { metricQueries } from "./observation-queries"
import { HttpError } from "./http-error"

type Row = Record<string, unknown>
const retentionSchema = z.compile(
  z
    .object({
      cleanup_interval_seconds: z.number().int().min(1).max(86400),
      task_max_count: z.number().int().nonnegative().nullable(),
      task_retention_hours: z.number().nonnegative().nullable(),
      dead_worker_retention_hours: z.number().nonnegative().nullable(),
    })
    .strict(),
)
const list = z.array(z.string().max(1024)).max(1000).default([])
const exportSchema = z.compile(
  z
    .object({
      kind: z.enum(["explorer", "raw-events"]),
      mode: z.enum(["tasks", "workflows"]).optional(),
      from: z.iso.datetime({ offset: true }),
      to: z.iso.datetime({ offset: true }),
      query: z.string().max(4096).default(""),
      states: list,
      types: list,
      workers: list,
      workflowStates: list,
      rootTypes: list,
      sortField: z.string().default("last_updated"),
      sortDirection: z.enum(["ASC", "DESC"]).default("DESC"),
    })
    .strict(),
)
const backupSchema = z.compile(
  z
    .object({
      version: z.literal(1),
      tasks: z.array(z.record(z.string(), z.unknown())).default([]),
      events: z.array(z.record(z.string(), z.unknown())).default([]),
      workers: z.array(z.record(z.string(), z.unknown())).default([]),
    })
    .strict(),
)
const fields = {
  task: "id,type,state,worker,sent_at,received_at,started_at,succeeded_at,failed_at,retried_at,runtime,last_updated,retries,exchange,routing_key,root_id,workflow_id,parent_id,result,exception".split(
    ",",
  ),
  workflow:
    "id,root_task_id,root_task_type,aggregate_state,first_seen_at,last_updated,task_count,completed_count,failure_count,retry_count,active_count,worker_count,latest_exception_preview".split(
      ",",
    ),
  event: "id,timestamp,event_type,task_id,hostname,data".split(","),
}
const idString = (value: unknown) =>
  String(value ?? "")
    .replace(/^[^:]+:/, "")
    .replace(/^[⟨<'"]|[⟩>'"]$/g, "")
const csvCell = (value: unknown) => '"' + String(value ?? "").replaceAll('"', '""') + '"'
export class ObservationApi {
  private retention: z.infer<typeof retentionSchema>
  constructor(
    private readonly db: Pick<Surreal, "query">,
    private readonly config: Config,
    private readonly bridgeStatus: () => Promise<Row | null>,
  ) {
    this.retention = {
      cleanup_interval_seconds: config.cleanupIntervalSeconds,
      task_max_count: config.taskMaxCount ?? null,
      task_retention_hours: config.taskRetentionHours ?? null,
      dead_worker_retention_hours: config.deadWorkerRetentionHours ?? null,
    }
  }
  async rows(sql: string, bindings: Record<string, unknown> = {}): Promise<Row[]> {
    const results = await this.db.query<[Row[]]>(sql, bindings).json().collect()
    const rows = results.at(-1)
    if (!Array.isArray(rows)) throw new Error("Invalid observation result")
    return rows as Row[]
  }
  async counts() {
    const [tasks, events, workers] = await Promise.all(
      ["task", "event", "worker"].map(async (table) =>
        Number((await this.rows(`SELECT count() AS count FROM ${table} GROUP ALL`))[0]?.count ?? 0),
      ),
    )
    return { tasks, events, workers }
  }
  private async boundedBody(request: Request, limit: number): Promise<Uint8Array> {
    const reader = request.body?.getReader()
    if (!reader) throw new HttpError(422, "Request body required")
    let size = 0
    const parts: Uint8Array[] = []
    try {
      while (true) {
        const part = await reader.read()
        if (part.done) break
        size += part.value.length
        if (size > limit) {
          await reader.cancel()
          throw new HttpError(413, "Request too large")
        }
        parts.push(part.value)
      }
      return Buffer.concat(parts)
    } finally {
      reader.releaseLock()
    }
  }
  private async json(request: Request): Promise<unknown> {
    try {
      return JSON.parse(Buffer.from(await this.boundedBody(request, 65536)).toString("utf8"))
    } catch (error) {
      if (error instanceof HttpError) throw error
      throw new HttpError(422, "Invalid request")
    }
  }
  async handle(request: Request, pathname: string, replay: boolean): Promise<Response | null> {
    if (pathname === "/api/settings/info" && request.method === "GET") {
      const counts = await this.counts()
      const bridge = await this.bridgeStatus()
      const endpoint = new URL(this.config.surrealdbUrl)
      endpoint.username = ""
      endpoint.password = ""
      endpoint.search = ""
      endpoint.hash = ""
      const external = !!this.config.surrealdbExternalUrl
      return Response.json({
        cpu_usage: os.loadavg(),
        memory_usage: process.memoryUsage().rss / 1024,
        uptime: process.uptime(),
        server_hostname: os.hostname(),
        server_port: this.config.port,
        server_version: "v0.2.0",
        server_os: os.type(),
        server_name: os.hostname(),
        python_version: bridge?.python_version ?? "unavailable",
        timezone: this.config.timezone,
        task_count: counts.tasks,
        worker_count: counts.workers,
        event_count: counts.events,
        surrealdb: {
          endpoint: endpoint.toString().replace(/\/$/, ""),
          namespace: this.config.surrealdbNamespace,
          database: this.config.surrealdbDatabase,
          topology: external ? "external" : "embedded",
          storage: external ? null : this.config.surrealdbStorage,
          durability: external ? "external" : this.config.surrealdbStorage === "memory" ? "memory" : "persistent",
        },
        ingestion: {
          batch_interval_ms: this.config.ingestionBatchIntervalMs,
          queue_size: 0,
          buffer_size: 0,
          dropped_events: 0,
          events_ingested_total: 0,
          flushes_total: 0,
          ...(bridge?.ingestion as Row),
        },
      })
    }
    if (pathname === "/api/settings/retention") {
      if (request.method === "PUT") {
        if (replay) throw new HttpError(403, "Snapshot is read-only")
        const parsed = retentionSchema.safeParse(await this.json(request))
        if (!parsed.success) throw new HttpError(422, "Invalid retention settings")
        this.retention = parsed.data
      }
      return Response.json({ settings: this.retention, counts: await this.counts() })
    }
    if (pathname === "/api/settings/cleanup" && request.method === "POST") {
      if (replay) throw new HttpError(403, "Snapshot is read-only")
      await this.cleanup()
      return Response.json({ success: true, counts: await this.counts() })
    }
    if (pathname === "/api/settings/clear" && request.method === "POST") {
      if (replay) throw new HttpError(403, "Snapshot is read-only")
      await this.db.query(
        "BEGIN TRANSACTION; DELETE event; DELETE workflow_task; DELETE task; DELETE workflow; DELETE worker; COMMIT TRANSACTION;",
      )
      return Response.json(true)
    }
    if (pathname === "/api/settings/export" && request.method === "GET") {
      const [tasks, events, workers] = await Promise.all(
        ["task", "event", "worker"].map((table) => this.rows(`SELECT * FROM ${table}`)),
      )
      return Response.json(
        { version: 1, tasks, events, workers },
        { headers: { "Content-Disposition": "attachment; filename=celery_insights_backup.json" } },
      )
    }
    if (pathname === "/api/settings/import" && request.method === "POST") {
      if (replay) throw new HttpError(403, "Snapshot is read-only")
      const bytes = await this.boundedBody(request, 101 * 1024 * 1024)
      const bounded = new Request(request.url, { method: "POST", headers: request.headers, body: Buffer.from(bytes) })
      let data: unknown
      try {
        const file = (await bounded.formData()).get("file")
        if (!(file instanceof File) || file.size > 100 * 1024 * 1024) throw new Error("Invalid file")
        data = JSON.parse(await file.text())
      } catch {
        return Response.json({ success: false, error: "Invalid JSON file" })
      }
      return this.importBackup(data)
    }
    if (pathname === "/api/exports/csv" && request.method === "POST") return this.exportCsv(await this.json(request))
    if (pathname.startsWith("/metrics") && request.method === "GET") return this.metrics(pathname)
    return null
  }
  async importBackup(value: unknown): Promise<Response> {
    const parsed = backupSchema.safeParse(value)
    if (!parsed.success) return Response.json({ success: false, error: "Invalid backup format" })
    const bindings: Record<string, unknown> = {}
    const statements = [
      "BEGIN TRANSACTION",
      "DELETE event",
      "DELETE workflow_task",
      "DELETE task",
      "DELETE workflow",
      "DELETE worker",
    ]
    const imported = { tasks: 0, events: 0, workers: 0 }
    for (const [key, table] of [
      ["tasks", "task"],
      ["events", "event"],
      ["workers", "worker"],
    ] as const) {
      for (const [index, record] of parsed.data[key].entries()) {
        if (typeof record.id !== "string" || !record.id.startsWith(table + ":"))
          return Response.json({ success: false, error: "Invalid backup record" })
        const { id, ...content } = record
        const dateFields =
          table === "task"
            ? [
                "sent_at",
                "received_at",
                "started_at",
                "succeeded_at",
                "failed_at",
                "retried_at",
                "revoked_at",
                "rejected_at",
                "last_updated",
                "first_observed_at",
                "execution_observed_at",
                "execution_active_at",
              ]
            : table === "event"
              ? ["timestamp"]
              : ["last_updated"]
        for (const field of dateFields) {
          if (typeof content[field] === "string") {
            const date = new Date(content[field])
            if (!Number.isFinite(date.valueOf()))
              return Response.json({ success: false, error: "Invalid backup timestamp" })
            content[field] = date
          }
        }
        bindings[`${table}_${index}_id`] = idString(id)
        bindings[`${table}_${index}_data`] = content
        statements.push(`CREATE type::record('${table}', $${table}_${index}_id) CONTENT $${table}_${index}_data`)
        imported[key]++
      }
    }
    for (const [index, step] of planWorkflowBackfill(
      parsed.data.tasks.map((task) => ({ ...task, id: String(task.id) })),
    ).entries()) {
      const renamed = step.sql.replace(
        /\$([A-Za-z][A-Za-z0-9_]*)/g,
        (_match, name: string) => `$workflow_${index}_${name}`,
      )
      statements.push(renamed)
      for (const [name, value] of Object.entries(step.bindings)) bindings[`workflow_${index}_${name}`] = value
    }
    statements.push("COMMIT TRANSACTION")
    await this.db.query(statements.join(";\n") + ";", bindings)
    return Response.json({ success: true, imported })
  }
  async cleanup(): Promise<void> {
    const remove = new Set<RecordId>()
    if (this.retention.task_max_count !== null && this.retention.task_max_count !== undefined) {
      const total = Number((await this.rows("SELECT count() AS total FROM task GROUP ALL"))[0]?.total ?? 0)
      let excess = total - this.retention.task_max_count
      if (excess > 0) {
        const [workflows] = await this.db.query<[Array<{ id: RecordId; task_count: number }>]>(
          "SELECT id, task_count FROM workflow ORDER BY last_updated ASC",
        )
        for (const workflow of workflows) {
          remove.add(workflow.id)
          excess -= workflow.task_count ?? 0
          if (excess <= 0) break
        }
      }
    }
    if (this.retention.task_retention_hours !== null && this.retention.task_retention_hours !== undefined) {
      const [workflows] = await this.db.query<[Array<{ id: RecordId }>]>(
        "SELECT id FROM workflow WHERE last_updated < time::now() - $hours * 1h",
        { hours: this.retention.task_retention_hours },
      )
      for (const workflow of workflows) remove.add(workflow.id)
    }
    if (remove.size) {
      const workflow_ids = [...remove]
      await this.db.query(
        "BEGIN TRANSACTION; LET $workflow_names = $workflow_ids.map(|$id| record::id($id)); LET $members = SELECT VALUE id FROM task WHERE workflow_id IN $workflow_names; LET $task_ids = $members.map(|$id| record::id($id)); DELETE event WHERE task_id IN $task_ids; DELETE workflow_task WHERE `in` IN $workflow_ids OR out IN $members; DELETE task WHERE id IN $members; DELETE workflow WHERE id IN $workflow_ids; COMMIT TRANSACTION;",
        { workflow_ids },
      )
    }
    if (this.retention.dead_worker_retention_hours !== null && this.retention.dead_worker_retention_hours !== undefined)
      await this.db.query("DELETE worker WHERE status = 'offline' AND last_updated < time::now() - $hours * 1h;", {
        hours: this.retention.dead_worker_retention_hours,
      })
  }
  cleanupInterval(): number {
    return this.retention.cleanup_interval_seconds * 1000
  }
  async exportCsv(value: unknown): Promise<Response> {
    const parsed = exportSchema.safeParse(value)
    if (!parsed.success || (parsed.data.kind === "explorer" && !parsed.data.mode))
      throw new HttpError(422, "Invalid export request")
    const body = parsed.data
    const table = body.kind === "raw-events" ? "event" : body.mode === "workflows" ? "workflow" : "task"
    const time = table === "event" ? "timestamp" : "last_updated"
    const conditions = [`${time} >= <datetime>$from`, `${time} <= <datetime>$to`]
    const bindings: Record<string, unknown> = { from: body.from, to: body.to }
    const mappings =
      table === "task"
        ? { state: body.states, type: body.types, worker: body.workers }
        : table === "workflow"
          ? { aggregate_state: body.workflowStates, root_task_type: body.rootTypes }
          : { event_type: body.types }
    for (const [field, items] of Object.entries(mappings))
      if (items.length) {
        conditions.push(`${field} IN $${field}`)
        bindings[field] = items
      }
    let prelude: string[] = []
    let source: string = table
    if (table !== "event" && trimQuery(body.query)) {
      const search = table === "task" ? buildIndexedTaskSearch(body.query) : buildIndexedWorkflowSearch(body.query)
      prelude = search.prelude
      source = search.source
      conditions.push(`(${search.clause})`)
      Object.assign(bindings, search.bindings)
    } else if (table === "event" && body.query.trim()) {
      const searchable = ["event_type", "task_id", "hostname", "data"]
      conditions.push(
        "(" +
          searchable
            .map((field) => `string::contains(string::lowercase(string::concat('', ${field} ?? '')), $query)`)
            .join(" OR ") +
          ")",
      )
      bindings.query = body.query.trim().toLowerCase()
    }
    const allowedSort =
      table === "task"
        ? ["last_updated", "state", "type", "worker", "runtime", "sent_at", "started_at"]
        : [
            "last_updated",
            "aggregate_state",
            "root_task_type",
            "task_count",
            "failure_count",
            "active_count",
            "worker_count",
          ]
    const sort =
      table === "event" ? "timestamp" : allowedSort.includes(body.sortField) ? body.sortField : "last_updated"
    const rows = await this.rows(
      `${prelude.join("")}SELECT * FROM ${source} WHERE ${conditions.join(" AND ")} ORDER BY ${sort} ${table === "event" ? "DESC" : body.sortDirection}`,
      bindings,
    )
    const columns = fields[table]
    const content =
      [
        columns.map(csvCell).join(","),
        ...rows.map((row) =>
          columns
            .map((field) =>
              csvCell(
                ["id", "root_task_id", "task_id"].includes(field)
                  ? idString(row[field])
                  : typeof row[field] === "object" && row[field] !== null && row[field] !== undefined
                    ? JSON.stringify(row[field])
                    : row[field],
              ),
            )
            .join(","),
        ),
      ].join("\r\n") + "\r\n"
    return new Response(content, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${table === "event" ? "raw-events" : body.mode}.csv"`,
      },
    })
  }
  async metrics(pathname: string): Promise<Response> {
    const registry = new Registry()
    const gauge = (name: string, help: string, value: number) =>
      new Gauge({ name, help, registers: [registry] }).set(value)
    const labelled = (name: string, help: string, label: string, rows: Row[], field: string) => {
      const metric = new Gauge({ name, help, labelNames: [label], registers: [registry] })
      for (const row of rows) metric.set({ [label]: String(row[field] ?? "unknown") }, Number(row.count ?? 0))
    }
    if (pathname === "/metrics/system") {
      gauge("celery_insights_uptime_seconds", "Process uptime", process.uptime())
      gauge("celery_insights_memory_rss_bytes", "Resident memory", process.memoryUsage().rss)
      const load = new Gauge({
        name: "celery_insights_cpu_load",
        help: "System CPU load",
        labelNames: ["interval"],
        registers: [registry],
      })
      os.loadavg().forEach((value, index) => load.set({ interval: ["1m", "5m", "15m"][index] }, value))
      const bridge = await this.bridgeStatus()
      const ingestion = bridge?.ingestion as Row | undefined
      for (const [name, field] of Object.entries({
        events_ingested_total: "events_ingested_total",
        events_dropped_total: "dropped_events",
        flushes_total: "flushes_total",
        buffer_size: "buffer_size",
        queue_size: "queue_size",
      }))
        gauge(`celery_insights_${name}`, field, Number(ingestion?.[field] ?? 0))
      for (const [table, count] of Object.entries(await this.counts()))
        gauge(`celery_insights_db_${table}_count`, "Database records", count)
    } else {
      const rows = async (name: keyof typeof metricQueries) => this.rows(metricQueries[name])
      const [states, workers, runtimes] = await Promise.all([
        rows("query_task_counts_by_state"),
        rows("query_worker_counts"),
        rows("query_task_runtime_values"),
      ])
      gauge(
        "celery_tasks_total",
        "Total tasks",
        states.reduce((sum, row) => sum + Number(row.count), 0),
      )
      labelled("celery_tasks_by_state", "Tasks by state", "state", states, "state")
      gauge(
        "celery_workers_total",
        "Total workers",
        workers.reduce((sum, row) => sum + Number(row.count), 0),
      )
      for (const status of ["online", "offline"])
        gauge(
          `celery_workers_${status}`,
          "Worker status",
          Number(workers.find((row) => row.status === status)?.count ?? 0),
        )
      for (const [name, state] of [
        ["succeeded", "SUCCESS"],
        ["failed", "FAILURE"],
        ["retried", "RETRY"],
      ])
        gauge(
          `celery_tasks_${name}_total`,
          "Task states",
          Number(states.find((row) => row.state === state)?.count ?? 0),
        )
      const buckets = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300]
      const histogram = new Histogram({
        name: "celery_task_runtime_seconds",
        help: "Task runtime",
        buckets,
        registers: [registry],
      })
      for (const row of runtimes) if (typeof row.runtime === "number") histogram.observe(row.runtime)
      if (pathname === "/metrics/verbose") {
        for (const [name, label, query, field] of [
          ["celery_tasks_by_type", "task_type", "query_tasks_by_type", "type"],
          ["celery_tasks_by_worker", "worker", "query_tasks_by_worker", "worker"],
          ["celery_exceptions_by_type", "exception", "query_exceptions_by_type", "exception"],
          ["celery_worker_active_tasks", "worker", "query_worker_active_tasks", "worker"],
          ["celery_worker_processed_tasks", "worker", "query_worker_processed_tasks", "worker"],
        ] as const)
          labelled(name, name, label, await rows(query), field)
        const byType = new Histogram({
          name: "celery_task_runtime_seconds_by_type",
          help: "Task runtime by type",
          labelNames: ["task_type"],
          buckets,
          registers: [registry],
        })
        for (const row of await rows("query_runtime_by_type"))
          if (typeof row.runtime === "number") byType.observe({ task_type: String(row.type ?? "unknown") }, row.runtime)
      }
    }
    return new Response(await registry.metrics(), {
      headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
    })
  }
}
