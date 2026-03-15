import { z } from "zod"

/**
 * Coerces string/boolean values to boolean.
 * Handles "true"/"false" strings correctly (unlike z.coerce.boolean which uses Boolean()).
 */
const booleanFromEnv = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === "string" ? v === "true" || v === "1" : v))

const configSchema = z
  .object({
    // Server
    port: z.coerce.number().int().positive().default(8555),

    // SurrealDB
    surrealdbUrl: z.string().url().default("ws://localhost:8557/rpc"),
    surrealdbExternalUrl: z.string().url().optional(),
    surrealdbIngesterPass: z.string().min(1).default("changeme"),
    surrealdbFrontendPass: z.string().min(1).optional(),
    surrealdbNamespace: z.string().min(1).default("celery_insights"),
    surrealdbDatabase: z.string().min(1).default("main"),
    surrealdbStorage: z.string().default("memory"),
    surrealdbPort: z.coerce.number().int().positive().default(8557),

    // Ingestion control
    ingestionEnabled: booleanFromEnv.default(true),
    ingestionLeaderElection: booleanFromEnv.default(true),
    ingestionLockTtlSeconds: z.coerce.number().int().positive().default(30),
    ingestionLockHeartbeatSeconds: z.coerce.number().int().positive().default(10),

    // Data retention (passed to Python)
    cleanupIntervalSeconds: z.coerce.number().int().positive().default(60),
    taskMaxCount: z.coerce.number().int().positive().optional(),
    taskRetentionHours: z.coerce.number().positive().optional(),
    deadWorkerRetentionHours: z.coerce.number().positive().optional().default(24),

    // Ingestion performance
    ingestionBatchIntervalMs: z.coerce.number().int().positive().default(100),

    // Celery connection (passed to Python)
    brokerUrl: z.string().default("amqp://guest:guest@host.docker.internal/"),
    resultBackend: z.string().default("redis://host.docker.internal:6379/0"),
    configFile: z.string().default("/app/config.py"),
    debugBundlePath: z.string().min(1).optional(),
    timezone: z.string().default("UTC"),
    debug: booleanFromEnv.default(false),

    // Logging
    logFormat: z.enum(["pretty", "json"]).default("pretty"),
    logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  })
  .transform((c) => ({
    ...c,
    // When SURREALDB_EXTERNAL_URL is set and SURREALDB_URL is still the default,
    // use the external URL for all connections
    surrealdbUrl:
      c.surrealdbExternalUrl && c.surrealdbUrl === "ws://localhost:8557/rpc" ? c.surrealdbExternalUrl : c.surrealdbUrl,
  }))
  .refine((c) => c.ingestionLockHeartbeatSeconds < c.ingestionLockTtlSeconds, {
    message: "INGESTION_LOCK_HEARTBEAT_SECONDS must be less than INGESTION_LOCK_TTL_SECONDS",
  })

export type Config = z.infer<typeof configSchema>

const ENV_KEY_MAP: Record<string, string> = {
  PORT: "port",
  SURREALDB_URL: "surrealdbUrl",
  SURREALDB_EXTERNAL_URL: "surrealdbExternalUrl",
  SURREALDB_INGESTER_PASS: "surrealdbIngesterPass",
  SURREALDB_FRONTEND_PASS: "surrealdbFrontendPass",
  SURREALDB_NAMESPACE: "surrealdbNamespace",
  SURREALDB_DATABASE: "surrealdbDatabase",
  SURREALDB_STORAGE: "surrealdbStorage",
  SURREALDB_PORT: "surrealdbPort",
  INGESTION_ENABLED: "ingestionEnabled",
  INGESTION_LEADER_ELECTION: "ingestionLeaderElection",
  INGESTION_LOCK_TTL_SECONDS: "ingestionLockTtlSeconds",
  INGESTION_LOCK_HEARTBEAT_SECONDS: "ingestionLockHeartbeatSeconds",
  CLEANUP_INTERVAL_SECONDS: "cleanupIntervalSeconds",
  TASK_MAX_COUNT: "taskMaxCount",
  TASK_RETENTION_HOURS: "taskRetentionHours",
  DEAD_WORKER_RETENTION_HOURS: "deadWorkerRetentionHours",
  INGESTION_BATCH_INTERVAL_MS: "ingestionBatchIntervalMs",
  BROKER_URL: "brokerUrl",
  RESULT_BACKEND: "resultBackend",
  CONFIG_FILE: "configFile",
  DEBUG_BUNDLE_PATH: "debugBundlePath",
  TIMEZONE: "timezone",
  DEBUG: "debug",
  LOG_FORMAT: "logFormat",
  LOG_LEVEL: "logLevel",
}

function envToConfig(env: Record<string, string | undefined>): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {}
  for (const [envKey, configKey] of Object.entries(ENV_KEY_MAP)) {
    if (env[envKey] !== undefined) {
      result[configKey] = env[envKey]
    }
  }
  return result
}

export function parseConfig(env: Record<string, string | undefined> = process.env): Config {
  return configSchema.parse(envToConfig(env))
}

export const config = parseConfig()
