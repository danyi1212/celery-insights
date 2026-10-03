import { createHash } from "node:crypto"
import { Queries, Results, ToolError, type Row, array, contains, iso, number, object, plainId } from "./common"

const WORKER_FIELDS =
  "record::id(id) AS hostname, status, last_updated, inspect, inspect_data, IF status = 'online' THEN 0 ELSE IF status = 'offline' THEN 1 ELSE 2 END AS priority"
const categories = { active: "running", reserved: "reserved", scheduled: "scheduled" } as const
const parsedInspect = (worker: Row): Row => {
  if (worker.inspect_data && typeof worker.inspect_data === "object") return object(worker.inspect_data)
  try {
    return object(JSON.parse(String(worker.inspect ?? "null")))
  } catch {
    return {}
  }
}
const freshness = (inspect: Row): Row =>
  Object.fromEntries(
    ["active", "reserved", "scheduled", "registered", "active_queues", "stats"].map((key) => [
      key,
      {
        availability: key in inspect ? "available" : "unavailable",
        observed_at: iso(object(inspect._observed_at)[key]),
      },
    ]),
  )
const activityRows = (inspect: Row): Row[] =>
  Object.entries(categories)
    .flatMap(([key, activity], priority) =>
      array(inspect[key]).map((value, index) => {
        const scheduled = object(value)
        const request = key === "scheduled" ? object(scheduled.request) : scheduled
        return {
          task_id: typeof request.id === "string" ? request.id : null,
          name: request.name ?? request.type ?? null,
          activity,
          started_at: typeof request.time_start === "number" ? new Date(request.time_start * 1000).toISOString() : null,
          eta: iso(scheduled.eta),
          workflow_id: null,
          task_record_available: false,
          _key: `${priority}:${String(request.id ?? index)}`,
        }
      }),
    )
    .sort((left, right) =>
      String(left._key) < String(right._key) ? -1 : String(left._key) > String(right._key) ? 1 : 0,
    )
const workerSummary = (worker: Row): Row => {
  const inspect = parsedInspect(worker)
  const groups = new Map<string | null, Row>()
  for (const row of activityRows(inspect)) {
    const name = typeof row.name === "string" ? row.name : null
    const group = groups.get(name) ?? { name, running: 0, reserved: 0, scheduled: 0 }
    group[String(row.activity)] = number(group[String(row.activity)]) + 1
    groups.set(name, group)
  }
  const queues = array(inspect.active_queues)
    .map((value) => object(value).name)
    .filter((value) => typeof value === "string")
  return {
    hostname: plainId(worker.hostname),
    status: worker.status ?? null,
    last_updated: worker.last_updated ?? null,
    inspection: freshness(inspect),
    activity_counts: Object.fromEntries(
      Object.entries(categories).map(([key, activity]) => [
        activity,
        key in inspect ? array(inspect[key]).length : null,
      ]),
    ),
    task_names: [...groups.values()].slice(0, 5),
    omitted_task_name_count: Math.max(0, groups.size - 5),
    queues: queues.slice(0, 5),
    queues_available: "active_queues" in inspect,
    omitted_queue_count: Math.max(0, queues.length - 5),
    registered_task_count: "registered" in inspect ? array(inspect.registered).length : null,
  }
}
const inspectionWarnings = (workers: Row[], now: number): string[] => {
  let unknown = false,
    stale = false
  for (const worker of workers) {
    const inspect = parsedInspect(worker)
    for (const key of Object.keys(categories)) {
      const observed = iso(object(inspect._observed_at)[key])
      if (!observed) unknown = true
      else if (now - Date.parse(observed) > 30_000) stale = true
    }
  }
  return [
    ...(unknown
      ? [
          "Some activity inspection sections or their capture times are unavailable; missing counts do not imply an idle worker.",
        ]
      : []),
    ...(stale ? ["Some activity inspection sections are more than 30 seconds old."] : []),
  ]
}

export class WorkerTools {
  constructor(
    private readonly q: Queries,
    private readonly r: Results,
    private readonly now: number,
  ) {}
  async list(position: unknown): Promise<Row> {
    const scope = this.r.scope
    scope.limit ??= 10
    scope.status ??= "all"
    const bindings: Row = {}
    const filters = ["true"]
    if (scope.hostname) {
      filters.push("string::contains(string::lowercase(record::id(id)), $hostname)")
      bindings.hostname = String(scope.hostname).toLowerCase()
    }
    if (scope.status !== "all") {
      filters.push("status = $status")
      bindings.status = scope.status
    }
    const where = filters.join(" AND ")
    const total = scope.task_name ? null : await this.q.count("worker", where, bindings)
    const selected: Row[] = [],
      sources: Row[] = []
    let after = object(position),
      lastScanned: Row | null = null,
      exhausted = false,
      unavailable = 0,
      scanned = 0
    const limit = number(scope.limit)
    // Legacy inspection is a JSON string. Bound capability scanning and continue
    // using the last scanned hostname when a page contains no matching workers.
    while (selected.length <= limit && scanned < 200) {
      const anchor = after.hostname
        ? " AND (priority > $afterPriority OR (priority = $afterPriority AND hostname > $afterHostname))"
        : ""
      const batch = await this.q.rows(
        `SELECT * FROM (SELECT ${WORKER_FIELDS} FROM worker WHERE ${where}) WHERE true${anchor} ORDER BY priority, hostname LIMIT 50`,
        { ...bindings, afterPriority: after.priority ?? 0, afterHostname: after.hostname ?? "" },
      )
      if (!batch.length) {
        exhausted = true
        break
      }
      for (const raw of batch) {
        lastScanned = raw
        scanned++
        const inspect = parsedInspect(raw)
        if (scope.task_name && !("registered" in inspect)) unavailable++
        const matches = array(inspect.registered).filter((value) => contains(value, scope.task_name))
        if (!scope.task_name || matches.length) {
          const summary = workerSummary(raw)
          if (scope.task_name) {
            summary.matching_registered_names = matches.slice(0, 5)
            summary.omitted_matching_name_count = Math.max(0, matches.length - 5)
          }
          summary._priority = raw.priority
          selected.push(summary)
          sources.push(raw)
        }
        if (selected.length > limit) break
      }
      after = { hostname: lastScanned!.hostname, priority: lastScanned!.priority }
      if (batch.length < 50) {
        exhausted = true
        break
      }
    }
    const base = {
      ...this.r.base(inspectionWarnings(sources, this.now)),
      effective_filters: { hostname: scope.hostname ?? null, task_name: scope.task_name ?? null, status: scope.status },
      diagnostics: unavailable ? [{ workers_with_unavailable_registration_in_scan: unavailable }] : [],
    }
    const result = this.r.page(base, "workers", selected, total, limit, (row) => ({
      hostname: row.hostname,
      priority: row._priority,
    }))
    const page = object(result.page)
    if (!page.has_more && !exhausted && lastScanned) {
      page.has_more = true
      page.next_cursor = this.r.cursors.encode(this.r.tool, scope, {
        hostname: lastScanned.hostname,
        priority: lastScanned.priority,
      })
    }
    for (const row of result.workers as Row[]) delete row._priority
    return this.r.finish(result)
  }
  async inspect(position: unknown): Promise<Row> {
    const scope = this.r.scope
    scope.section ??= "overview"
    if (scope.task_name && !["activity", "registered"].includes(String(scope.section)))
      throw new ToolError("invalid_arguments", "task_name requires section=activity or registered.")
    if (scope.section === "overview" && (scope.limit || position))
      throw new ToolError("invalid_arguments", "overview does not accept pagination.")
    const raw = await this.q.one(`SELECT ${WORKER_FIELDS} FROM type::record('worker', $hostname)`, {
      hostname: scope.hostname,
    })
    const inspect = parsedInspect(raw)
    const fingerprint = createHash("sha256").update(JSON.stringify(inspect)).digest("hex")
    const after = object(position)
    if (after.snapshot && after.snapshot !== fingerprint)
      throw new ToolError(
        "invalid_cursor",
        "Worker inspection changed; restart this section for a consistent snapshot.",
      )
    const base = {
      ...this.r.base(inspectionWarnings([raw], this.now)),
      worker: { hostname: scope.hostname, status: raw.status ?? null, last_updated: raw.last_updated ?? null },
      inspection: freshness(inspect),
    }
    if (scope.section === "registered" || scope.section === "queues") {
      const key = scope.section === "registered" ? "registered" : "active_queues"
      const names = array(inspect[key])
        .filter((value) => scope.section !== "registered" || contains(value, scope.task_name))
        .map((value, index) => {
          const queue = object(value)
          return scope.section === "registered"
            ? { name: String(value), _key: String(value) }
            : {
                name: queue.name ?? null,
                exchange: queue.exchange ?? null,
                routing_key: queue.routing_key ?? null,
                _key: `${queue.name ?? ""}:${JSON.stringify(queue.exchange ?? null)}:${queue.routing_key ?? ""}:${index}`,
              }
        })
        .sort((left, right) => (left._key < right._key ? -1 : left._key > right._key ? 1 : 0))
      scope.limit ??= 25
      const result = this.r.page(
        { ...base, available: key in inspect, effective_filters: { task_name: scope.task_name ?? null } },
        String(scope.section),
        names.filter((row) => !position || row._key > String(after.key)).slice(0, number(scope.limit) + 1),
        key in inspect ? names.length : null,
        number(scope.limit),
        (row) => ({ key: row._key, snapshot: fingerprint }),
      )
      for (const row of result[String(scope.section)] as Row[]) delete row._key
      return result
    }
    const activity = activityRows(inspect).filter((row) => contains(row.name, scope.task_name))
    const selected = (
      scope.section === "overview"
        ? activity
        : activity.filter((row) => !position || String(row._key) > String(after.key))
    ).slice(0, number(scope.limit ?? 15) + (scope.section === "overview" ? 0 : 1))
    const ids = selected.filter((row) => row.task_id).map((row) => row.task_id)
    const references = ids.length
      ? await this.q.rows(
          "SELECT record::id(id) AS task_id, workflow_id FROM task WHERE id IN array::map($ids, |$id| type::record('task', $id))",
          { ids },
        )
      : []
    for (const row of selected) {
      const reference = references.find((ref) => ref.task_id === row.task_id)
      row.workflow_id = reference?.workflow_id ?? null
      row.task_record_available = !!reference
    }
    if (scope.section === "overview") {
      for (const row of selected) delete row._key
      return this.r.finish({
        ...base,
        ...workerSummary(raw),
        concurrency: object(object(inspect.stats).pool)["max-concurrency"] ?? null,
        activity: selected,
        omitted_activity_counts: Object.fromEntries(
          Object.values(categories).map((category) => [
            category,
            categoryAvailable(inspect, category)
              ? activity.filter((row) => row.activity === category).length -
                selected.filter((row) => row.activity === category).length
              : null,
          ]),
        ),
      })
    }
    scope.limit ??= 15
    const result = this.r.page(
      { ...base, effective_filters: { task_name: scope.task_name ?? null } },
      "activity",
      selected,
      Object.keys(categories).every((key) => key in inspect) ? activity.length : null,
      number(scope.limit),
      (row) => ({ key: row._key, snapshot: fingerprint }),
    )
    for (const row of result.activity as Row[]) delete row._key
    return result
  }
}
const categoryAvailable = (inspect: Row, category: string): boolean =>
  Object.entries(categories).some(([key, value]) => value === category && key in inspect)
