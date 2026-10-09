import type { Config } from "./config"

/** Only Celery bridge and ingestion settings cross the process seam. */
export function pythonConfig(config: Config, replay: boolean, bridge?: { socket: string }) {
  return {
    version: 1,
    settings: {
      debug: config.debug,
      timezone: config.timezone,
      surrealdb_url: config.surrealdbUrl,
      surrealdb_external_url: config.surrealdbExternalUrl ?? null,
      surrealdb_ingester_pass: config.surrealdbIngesterPass,
      surrealdb_namespace: config.surrealdbNamespace,
      surrealdb_database: config.surrealdbDatabase,
      broker_url: config.brokerUrl,
      result_backend: config.resultBackend,
      config_file: config.configFile,
      celery_options: config.celeryOptions ?? {},
      debug_snapshot_mode: replay,
      search_indexing_enabled: config.searchIndexingEnabled && !replay,
      ingestion_batch_interval_ms: config.ingestionBatchIntervalMs,
      log_format: config.logFormat,
      log_level: config.logLevel,
      bridge_socket: bridge?.socket ?? "",
    },
  }
}

export function pythonEnvironment(env: Record<string, string | undefined>): Record<string, string> {
  const safe: Record<string, string> = { PYTHONUNBUFFERED: "1" }
  for (const name of ["PATH", "LANG", "LC_ALL", "SSL_CERT_FILE", "SSL_CERT_DIR", "SYSTEMROOT"]) {
    if (env[name] !== undefined) safe[name] = env[name]
  }
  return safe
}
