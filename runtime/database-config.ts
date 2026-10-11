import { createHmac, randomBytes } from "node:crypto"
import type { Config } from "./config"

/** Root authority stays in Bun; persistent stores need stable deployment credentials. */
export function prepareDatabaseConfig(config: Config, explicitIngesterPassword: boolean): Config {
  if (!config.surrealdbRootPass && (config.surrealdbExternalUrl || config.surrealdbStorage !== "memory"))
    throw new Error("Persistent/external databases require database.observation.root_password (or _file)")
  if (config.surrealdbExternalUrl && !explicitIngesterPassword)
    throw new Error("External databases require database.observation.ingester_password (or _file)")
  return { ...config, surrealdbRootPass: config.surrealdbRootPass ?? randomBytes(32).toString("base64url") }
}

/** Separate the read credential from the OWNER credential, including across replicas. */
export function databaseReaderPassword(config: Config): string {
  return createHmac("sha256", config.surrealdbIngesterPass)
    .update("celery-insights-observation-reader-v1")
    .digest("base64url")
}
