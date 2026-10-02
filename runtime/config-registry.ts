/** The deployment configuration catalog. Only entries with env names support permanent overrides. */
export interface Setting {
  path: string
  key: string
  type: "string" | "number" | "boolean"
  env?: string
  legacy?: string
  secret?: boolean
  filePath?: boolean
}

export const SETTINGS: readonly Setting[] = [
  { path: "server.port", key: "port", type: "number", env: "CI_PORT", legacy: "PORT" },
  {
    path: "database.observation.url",
    key: "surrealdbUrl",
    type: "string",
    env: "CI_DATABASE_URL",
    legacy: "SURREALDB_URL",
    secret: true,
  },
  {
    path: "database.observation.ingester_password",
    key: "surrealdbIngesterPass",
    type: "string",
    env: "CI_DATABASE_INGESTER_PASSWORD",
    legacy: "SURREALDB_INGESTER_PASS",
    secret: true,
  },
  {
    path: "migration.legacy_frontend_password",
    key: "surrealdbFrontendPass",
    type: "string",
    legacy: "SURREALDB_FRONTEND_PASS",
    secret: true,
  },
  { path: "database.observation.namespace", key: "surrealdbNamespace", type: "string", legacy: "SURREALDB_NAMESPACE" },
  { path: "database.observation.database", key: "surrealdbDatabase", type: "string", legacy: "SURREALDB_DATABASE" },
  {
    path: "database.observation.embedded.storage",
    key: "surrealdbStorage",
    type: "string",
    env: "CI_DATABASE_STORAGE",
    legacy: "SURREALDB_STORAGE",
  },
  { path: "database.observation.embedded.port", key: "surrealdbPort", type: "number", legacy: "SURREALDB_PORT" },
  {
    path: "ingestion.enabled",
    key: "ingestionEnabled",
    type: "boolean",
    env: "CI_INGESTION_ENABLED",
    legacy: "INGESTION_ENABLED",
  },
  {
    path: "ingestion.leader_election.enabled",
    key: "ingestionLeaderElection",
    type: "boolean",
    legacy: "INGESTION_LEADER_ELECTION",
  },
  {
    path: "ingestion.leader_election.ttl_seconds",
    key: "ingestionLockTtlSeconds",
    type: "number",
    legacy: "INGESTION_LOCK_TTL_SECONDS",
  },
  {
    path: "ingestion.leader_election.heartbeat_seconds",
    key: "ingestionLockHeartbeatSeconds",
    type: "number",
    legacy: "INGESTION_LOCK_HEARTBEAT_SECONDS",
  },
  {
    path: "retention.cleanup_interval_seconds",
    key: "cleanupIntervalSeconds",
    type: "number",
    legacy: "CLEANUP_INTERVAL_SECONDS",
  },
  { path: "retention.tasks.max_count.value", key: "taskMaxCount", type: "number", legacy: "TASK_MAX_COUNT" },
  {
    path: "retention.tasks.max_age_hours.value",
    key: "taskRetentionHours",
    type: "number",
    legacy: "TASK_RETENTION_HOURS",
  },
  {
    path: "retention.workers.max_age_hours.value",
    key: "deadWorkerRetentionHours",
    type: "number",
    legacy: "DEAD_WORKER_RETENTION_HOURS",
  },
  {
    path: "ingestion.batch_interval_ms",
    key: "ingestionBatchIntervalMs",
    type: "number",
    legacy: "INGESTION_BATCH_INTERVAL_MS",
  },
  {
    path: "celery.broker_url",
    key: "brokerUrl",
    type: "string",
    env: "CI_BROKER_URL",
    legacy: "BROKER_URL",
    secret: true,
  },
  {
    path: "celery.result_backend",
    key: "resultBackend",
    type: "string",
    env: "CI_RESULT_BACKEND",
    legacy: "RESULT_BACKEND",
    secret: true,
  },
  {
    path: "celery.legacy_python_config_file",
    key: "configFile",
    type: "string",
    legacy: "CONFIG_FILE",
    filePath: true,
  },
  {
    path: "diagnostics.replay_bundle_file",
    key: "debugBundlePath",
    type: "string",
    env: "CI_REPLAY_BUNDLE_FILE",
    legacy: "DEBUG_BUNDLE_PATH",
    filePath: true,
  },
  { path: "celery.timezone", key: "timezone", type: "string", legacy: "TIMEZONE" },
  { path: "server.debug", key: "debug", type: "boolean", legacy: "DEBUG" },
  { path: "logging.format", key: "logFormat", type: "string", env: "CI_LOG_FORMAT", legacy: "LOG_FORMAT" },
  { path: "logging.level", key: "logLevel", type: "string", env: "CI_LOG_LEVEL", legacy: "LOG_LEVEL" },
  { path: "server.api.host", key: "apiHost", type: "string", legacy: "HOST" },
  { path: "server.api.port", key: "apiPort", type: "number" },
  { path: "installation.public_url", key: "publicUrl", type: "string", env: "CI_PUBLIC_URL" },
  { path: "ui.demo_available", key: "demoAvailable", type: "boolean" },
  { path: "ui.defaults.theme", key: "uiTheme", type: "string" },
  { path: "ui.defaults.hide_welcome_banner", key: "uiHideWelcomeBanner", type: "boolean" },
  { path: "ui.defaults.raw_events_limit", key: "uiRawEventsLimit", type: "number" },
]
