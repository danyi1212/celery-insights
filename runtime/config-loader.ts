import path from "node:path"
import { readFileSync, existsSync } from "node:fs"
import { parse as parseToml } from "smol-toml"
import { validateConfig, type Config } from "./config"
import { SETTINGS, type Setting } from "./config-registry"

type Env = Record<string, string | undefined>
type Source = { source: string; secret: boolean }
export interface ResolvedConfig {
  config: Config
  provenance: Record<string, Source>
  warnings: string[]
}
export interface ConfigInputs {
  env?: Env
  configFile?: string
  cwd?: string
  readFile?: (file: string) => string
  exists?: (file: string) => boolean
}

const CELERY_OPTIONS = new Set([
  "broker_transport_options",
  "result_backend_transport_options",
  "broker_use_ssl",
  "redis_backend_use_ssl",
  "broker_connection_timeout",
  "broker_connection_retry",
  "broker_connection_retry_on_startup",
  "broker_connection_max_retries",
  "broker_channel_error_retry",
  "broker_pool_limit",
  "broker_heartbeat",
  "broker_heartbeat_checkrate",
  "broker_login_method",
  "redis_max_connections",
  "redis_socket_connect_timeout",
  "redis_socket_timeout",
  "redis_socket_keepalive",
  "redis_retry_on_timeout",
  "result_backend_always_retry",
  "result_backend_max_retries",
  "result_backend_base_sleep_between_retries_ms",
  "result_backend_max_sleep_between_retries_ms",
  "result_expires",
  "result_extended",
  "result_cache_max",
  "result_accept_content",
  "result_serializer",
  "accept_content",
  "task_serializer",
  "event_queue_durable",
  "event_queue_exclusive",
  "event_queue_expires",
  "event_queue_prefix",
  "event_queue_ttl",
  "control_queue_durable",
  "control_queue_exclusive",
  "control_queue_expires",
  "control_queue_ttl",
])

function validateCeleryData(value: unknown, depth = 0): void {
  if (depth > 16) throw new Error("celery.options: Maximum nesting depth exceeded")
  if (
    value instanceof Date ||
    value === null ||
    value === undefined ||
    (typeof value === "number" && !Number.isFinite(value))
  )
    throw new Error("celery.options: Only finite data values are supported")
  if (typeof value === "object") {
    const entries = Object.entries(value)
    if (entries.length > 1000) throw new Error("celery.options: Too many entries")
    for (const [key, child] of entries) {
      if (["__proto__", "prototype", "constructor"].includes(key))
        throw new Error("celery.options: Invalid property name")
      validateCeleryData(child, depth + 1)
    }
  }
}

function flatten(value: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    const full = prefix ? `${prefix}.${key}` : key
    if (item && typeof item === "object" && !Array.isArray(item) && !(item instanceof Date))
      Object.assign(result, flatten(item as Record<string, unknown>, full))
    else result[full] = item
  }
  return result
}

function convert(setting: Setting, value: unknown, fromEnv: boolean): unknown {
  if (fromEnv && setting.type === "boolean") {
    if (!["true", "false", "1", "0"].includes(String(value))) throw new Error(`${setting.path}: Expected boolean`)
    return value === "true" || value === "1"
  }
  if (fromEnv && setting.type === "number") {
    if (typeof value !== "string" || !value.trim() || !Number.isFinite(Number(value)))
      throw new Error(`${setting.path}: Expected number`)
    return Number(value)
  }
  if (typeof value !== setting.type || (setting.type === "number" && !Number.isFinite(value)))
    throw new Error(`${setting.path}: Expected ${setting.type}`)
  return value
}

export function resolveConfig(inputs: ConfigInputs = {}): ResolvedConfig {
  const env = inputs.env ?? process.env
  const cwd = inputs.cwd ?? process.cwd()
  const read = inputs.readFile ?? ((file: string) => readFileSync(file, "utf8"))
  const exists = inputs.exists ?? existsSync
  if (
    inputs.configFile &&
    env.CELERY_INSIGHTS_CONFIG_FILE &&
    path.resolve(cwd, inputs.configFile) !== path.resolve(cwd, env.CELERY_INSIGHTS_CONFIG_FILE)
  )
    throw new Error("Conflicting --config and CELERY_INSIGHTS_CONFIG_FILE")
  const selected = inputs.configFile ?? env.CELERY_INSIGHTS_CONFIG_FILE
  if (selected === "") throw new Error("CELERY_INSIGHTS_CONFIG_FILE must not be empty")
  const file = path.resolve(cwd, selected ?? "/etc/celery-insights/config.toml")
  let document: Record<string, unknown> = {}
  const hasFile = selected !== undefined || exists(file)
  if (hasFile) {
    let content: string
    try {
      content = read(file)
    } catch {
      throw new Error("Cannot read selected application configuration file")
    }
    if (Buffer.byteLength(content) > 1024 * 1024) throw new Error("Application configuration file exceeds 1 MiB")
    try {
      document = parseToml(content)
    } catch {
      throw new Error("Invalid TOML application configuration; check syntax and duplicate keys")
    }
    if (document.schema_version !== 1) throw new Error("schema_version must be 1")
  }
  const flat = flatten(document)
  const special = new Set([
    "schema_version",
    "database.observation.mode",
    "retention.tasks.max_count.enabled",
    "retention.tasks.max_age_hours.enabled",
    "retention.workers.max_age_hours.enabled",
  ])
  const allowed = new Set(SETTINGS.flatMap((s) => (s.secret ? [s.path, `${s.path}_file`] : [s.path])))
  function validateTables(table: Record<string, unknown>, prefix = ""): void {
    for (const [name, value] of Object.entries(table)) {
      const key = prefix ? `${prefix}.${name}` : name
      if (["__proto__", "prototype", "constructor"].includes(name))
        throw new Error("Invalid configuration property name")
      if (key === "celery.options") continue
      if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
        if (![...allowed, ...special].some((known) => known.startsWith(`${key}.`)))
          throw new Error(`Unknown configuration table: ${key}`)
        validateTables(value as Record<string, unknown>, key)
      }
    }
  }
  validateTables(document)
  for (const key of Object.keys(flat))
    if (!allowed.has(key) && !special.has(key) && !key.startsWith("celery.options."))
      throw new Error(`Unknown configuration key: ${key}`)
  const allowedEnv = new Set([
    "CELERY_INSIGHTS_CONFIG_FILE",
    ...SETTINGS.flatMap((s) => (s.env ? (s.secret ? [s.env, `${s.env}_FILE`] : [s.env]) : [])),
  ])
  for (const key of Object.keys(env))
    if (key.startsWith("CELERY_INSIGHTS_") && !allowedEnv.has(key) && env[key] !== undefined)
      throw new Error(`Unknown application environment variable: ${key}`)
  const values: Record<string, unknown> = {}
  const provenance: Record<string, Source> = {}
  const warnings: string[] = []
  for (const setting of SETTINGS) {
    const direct = flat[setting.path]
    const fileRef = setting.secret ? flat[`${setting.path}_file`] : undefined
    const old = setting.legacy ? env[setting.legacy] : undefined
    const current = setting.env ? env[setting.env] : undefined
    const envFile = setting.secret && setting.env ? env[`${setting.env}_FILE`] : undefined
    if (current !== undefined && envFile !== undefined)
      throw new Error(`${setting.path}: Specify either value or file, not both`)
    if (old !== undefined) warnings.push(`${setting.legacy} is deprecated; use ${setting.env ?? setting.path}`)
    if (old !== undefined && current !== undefined && convert(setting, old, true) !== convert(setting, current, true))
      throw new Error(`${setting.path}: Conflicting legacy and current environment variables`)
    let value: unknown
    let source = "default"
    let fromEnv = false
    let valueFile: unknown
    if (current !== undefined || envFile !== undefined) {
      value = current
      valueFile = envFile
      source = `env:${envFile !== undefined ? `${setting.env}_FILE` : setting.env}`
      fromEnv = true
    } else if (old !== undefined) {
      value = old
      source = `env:${setting.legacy}`
      fromEnv = true
    } else {
      if (direct !== undefined && fileRef !== undefined)
        throw new Error(`${setting.path}: Specify either value or file, not both`)
      value = direct
      valueFile = fileRef
      if (value !== undefined || valueFile !== undefined)
        source = `toml:${setting.path}${valueFile !== undefined ? "_file" : ""}`
    }
    if (valueFile !== undefined) {
      if (typeof valueFile !== "string" || !valueFile) throw new Error(`${setting.path}: Invalid secret file path`)
      try {
        value = read(path.resolve(fromEnv ? cwd : path.dirname(file), valueFile))
      } catch {
        throw new Error(`${setting.path}: Cannot read secret file`)
      }
      if (typeof value !== "string" || Buffer.byteLength(value) > 65536)
        throw new Error(`${setting.path}: Invalid secret file content`)
      value = value.replace(/\r?\n$/, "")
    }
    if (value !== undefined) {
      if (setting.secret && (value === "" || String(value).includes("\0")))
        throw new Error(`${setting.path}: Invalid empty or NUL-containing secret`)
      value = convert(setting, value, fromEnv)
      if (setting.filePath) value = path.resolve(fromEnv ? cwd : path.dirname(file), String(value))
      values[setting.key] = value
    }
    provenance[setting.path] = { source, secret: setting.secret ?? false }
  }
  const canonical =
    hasFile ||
    Object.keys(env).some(
      (key) => key.startsWith("CELERY_INSIGHTS_") && key !== "CELERY_INSIGHTS_CONFIG_FILE" && env[key] !== undefined,
    )
  const mode = flat["database.observation.mode"]
  if (mode !== undefined && mode !== "embedded" && mode !== "external")
    throw new Error("database.observation.mode: Expected embedded or external")
  if (canonical) {
    const explicitUrl = values.surrealdbUrl !== undefined
    if (mode === "embedded" && explicitUrl) throw new Error("Embedded database mode cannot specify an external URL")
    if (mode === "external" && !explicitUrl && !env.SURREALDB_EXTERNAL_URL)
      throw new Error("External database mode requires a URL")
    if (explicitUrl || mode === "external" || env.SURREALDB_EXTERNAL_URL)
      values.surrealdbExternalUrl = values.surrealdbUrl ?? env.SURREALDB_EXTERNAL_URL
    else values.surrealdbUrl = `ws://localhost:${values.surrealdbPort ?? 8557}/rpc`
    if (values.configFile === undefined) values.configFile = "" // No implicit executable config in canonical mode.
    if (
      values.configFile &&
      (values.brokerUrl !== undefined ||
        values.resultBackend !== undefined ||
        (document.celery && typeof document.celery === "object" && "options" in document.celery))
    )
      throw new Error("Legacy Celery module cannot coexist with canonical connection settings")
    if (values.debugBundlePath && values.surrealdbExternalUrl)
      throw new Error("Replay cannot use an external observation database")
  } else if (env.SURREALDB_EXTERNAL_URL !== undefined) {
    values.surrealdbExternalUrl = env.SURREALDB_EXTERNAL_URL
    warnings.push(
      "SURREALDB_EXTERNAL_URL is deprecated; use CELERY_INSIGHTS_DATABASE_URL or database.observation.mode/url",
    )
  }
  for (const base of [
    "retention.tasks.max_count",
    "retention.tasks.max_age_hours",
    "retention.workers.max_age_hours",
  ]) {
    const enabled = flat[`${base}.enabled`]
    if (enabled !== undefined && typeof enabled !== "boolean") throw new Error(`${base}.enabled: Expected boolean`)
    const setting = SETTINGS.find((s) => s.path === `${base}.value`)!
    if (enabled === false && !(setting.legacy && env[setting.legacy] !== undefined))
      values[setting.key] = base.includes("workers") ? null : undefined
    if (enabled === true && values[setting.key] === undefined)
      throw new Error(`${base}: Enabled limit requires a value`)
  }
  const celery = document.celery as Record<string, unknown> | undefined
  if (celery?.options !== undefined) {
    if (!celery.options || typeof celery.options !== "object" || Array.isArray(celery.options))
      throw new Error("celery.options: Expected table")
    const options = celery.options as Record<string, unknown>
    for (const key of ["broker_url", "result_backend", "timezone"])
      if (key in options) throw new Error(`celery.options.${key}: Use the canonical connection setting`)
    for (const key of Object.keys(options))
      if (!CELERY_OPTIONS.has(key))
        throw new Error(
          `celery.options.${key}: Unsupported data-only Celery option; use the explicit legacy module for Python-object configuration`,
        )
    validateCeleryData(options)
    values.celeryOptions = options
    provenance["celery.options"] = { source: "toml:celery.options", secret: true }
  }
  return { config: validateConfig(values), provenance, warnings }
}

export function describeConfig(resolved: ResolvedConfig): Record<string, unknown> {
  const entries: Record<string, unknown> = {}
  const config = resolved.config as unknown as Record<string, unknown>
  for (const s of SETTINGS)
    entries[s.path] = { value: s.secret ? "[redacted]" : (config[s.key] ?? null), ...resolved.provenance[s.path] }
  if (resolved.config.celeryOptions)
    entries["celery.options"] = { value: "[redacted]", ...resolved.provenance["celery.options"] }
  return entries
}
