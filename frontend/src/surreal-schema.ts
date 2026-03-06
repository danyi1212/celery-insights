import { Surreal } from "surrealdb"
import type { Config } from "./config"
import type { Logger } from "./logger"
import { bunLogger } from "./logger"

/**
 * Validates that a string is a safe SurrealDB identifier.
 * Prevents SQL injection through config values used in DDL statements.
 */
export function assertIdent(name: string, label: string): string {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        throw new Error(
            `Invalid SurrealDB identifier for ${label}: "${name}" — must match /^[a-zA-Z_][a-zA-Z0-9_]*$/`,
        )
    }
    return name
}

function toSurrealStrand(value: string): string {
    return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`
}

/**
 * Core schema: tables, fields, indexes, and permissions.
 *
 * Tables use IF NOT EXISTS to preserve data across restarts.
 * Fields and indexes use OVERWRITE to allow schema evolution.
 */
export const CORE_SCHEMA = `
DEFINE TABLE IF NOT EXISTS task SCHEMAFULL
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete NONE;

DEFINE FIELD OVERWRITE type ON task TYPE option<string>;
DEFINE FIELD OVERWRITE state ON task TYPE string;
DEFINE FIELD OVERWRITE sent_at ON task TYPE option<datetime>;
DEFINE FIELD OVERWRITE received_at ON task TYPE option<datetime>;
DEFINE FIELD OVERWRITE started_at ON task TYPE option<datetime>;
DEFINE FIELD OVERWRITE succeeded_at ON task TYPE option<datetime>;
DEFINE FIELD OVERWRITE failed_at ON task TYPE option<datetime>;
DEFINE FIELD OVERWRITE retried_at ON task TYPE option<datetime>;
DEFINE FIELD OVERWRITE revoked_at ON task TYPE option<datetime>;
DEFINE FIELD OVERWRITE rejected_at ON task TYPE option<datetime>;
DEFINE FIELD OVERWRITE runtime ON task TYPE option<float>;
DEFINE FIELD OVERWRITE last_updated ON task TYPE datetime;
DEFINE FIELD OVERWRITE args ON task TYPE option<string>;
DEFINE FIELD OVERWRITE kwargs ON task TYPE option<string>;
DEFINE FIELD OVERWRITE eta ON task TYPE option<string>;
DEFINE FIELD OVERWRITE expires ON task TYPE option<string>;
DEFINE FIELD OVERWRITE retries ON task TYPE option<int>;
DEFINE FIELD OVERWRITE exchange ON task TYPE option<string>;
DEFINE FIELD OVERWRITE routing_key ON task TYPE option<string>;
DEFINE FIELD OVERWRITE root_id ON task TYPE option<string>;
DEFINE FIELD OVERWRITE parent_id ON task TYPE option<string>;
DEFINE FIELD OVERWRITE children ON task TYPE array<string> DEFAULT [];
DEFINE FIELD OVERWRITE worker ON task TYPE option<string>;
DEFINE FIELD OVERWRITE result ON task TYPE option<string>;
DEFINE FIELD OVERWRITE result_truncated ON task TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE exception ON task TYPE option<string>;
DEFINE FIELD OVERWRITE traceback ON task TYPE option<string>;

DEFINE INDEX OVERWRITE idx_task_state ON task FIELDS state;
DEFINE INDEX OVERWRITE idx_task_type ON task FIELDS type;
DEFINE INDEX OVERWRITE idx_task_worker ON task FIELDS worker;
DEFINE INDEX OVERWRITE idx_task_root_id ON task FIELDS root_id;
DEFINE INDEX OVERWRITE idx_task_last_updated ON task FIELDS last_updated;

DEFINE TABLE IF NOT EXISTS event SCHEMALESS
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete NONE;

DEFINE INDEX OVERWRITE idx_event_task_id ON event FIELDS task_id;
DEFINE INDEX OVERWRITE idx_event_type ON event FIELDS event_type;
DEFINE INDEX OVERWRITE idx_event_timestamp ON event FIELDS timestamp;

DEFINE TABLE IF NOT EXISTS worker SCHEMALESS
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete NONE;

DEFINE FIELD OVERWRITE status ON worker TYPE string DEFAULT "online";
DEFINE FIELD OVERWRITE missed_polls ON worker TYPE int DEFAULT 0;
DEFINE INDEX OVERWRITE idx_worker_last_updated ON worker FIELDS last_updated;
DEFINE INDEX OVERWRITE idx_worker_status ON worker FIELDS status;

DEFINE TABLE IF NOT EXISTS ingestion_lock SCHEMAFULL
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete NONE;

DEFINE FIELD OVERWRITE holder ON ingestion_lock TYPE option<string>;
DEFINE FIELD OVERWRITE acquired_at ON ingestion_lock TYPE datetime;
DEFINE FIELD OVERWRITE heartbeat ON ingestion_lock TYPE datetime;
DEFINE FIELD OVERWRITE ttl_seconds ON ingestion_lock TYPE int DEFAULT 30;
`

/**
 * Frontend authentication schema — viewer table and record access method.
 * Only applied when SURREALDB_FRONTEND_PASS is configured.
 */
export const FRONTEND_AUTH_SCHEMA = `
DEFINE TABLE IF NOT EXISTS viewer SCHEMAFULL
  PERMISSIONS NONE;

DEFINE FIELD OVERWRITE name ON viewer TYPE string;
DEFINE FIELD OVERWRITE pass ON viewer TYPE string;

DEFINE ACCESS OVERWRITE frontend ON DATABASE TYPE RECORD
  SIGNUP NONE
  SIGNIN (
    SELECT * FROM viewer WHERE name = $name AND crypto::argon2::compare(pass, $pass)
  );
`

/**
 * Runs idempotent schema migration against SurrealDB using root credentials.
 *
 * Must run before any other connections — creates the namespace, database,
 * ingester user, all tables/fields/indexes, and optional frontend auth.
 */
export async function runSchemaMigration(config: Config, logger?: Logger): Promise<void> {
    const log = logger ?? bunLogger
    const ns = assertIdent(config.surrealdbNamespace, "namespace")
    const dbName = assertIdent(config.surrealdbDatabase, "database")

    const db = new Surreal()

    try {
        // Connect as root (only Bun knows root credentials)
        await db.connect(config.surrealdbUrl, {
            authentication: {
                username: "root",
                password: "root",
            },
        })

        // Create namespace and database (IF NOT EXISTS preserves existing data)
        await db.query(`DEFINE NAMESPACE IF NOT EXISTS ${ns}`).collect()
        await db.use({ namespace: ns })
        await db.query(`DEFINE DATABASE IF NOT EXISTS ${dbName}`).collect()
        await db.use({ namespace: ns, database: dbName })

        // Create ingester DB user (OVERWRITE updates password if changed)
        await db.query(
            `DEFINE USER OVERWRITE ingester ON DATABASE PASSWORD ${toSurrealStrand(config.surrealdbIngesterPass)} ROLES OWNER`,
        ).collect()

        // Apply core schema (tables, fields, indexes, permissions)
        await db.query(CORE_SCHEMA).collect()

        // Always create a read-only viewer user for the frontend.
        // SurrealDB v2 requires authentication even for tables with FULL select permissions —
        // anonymous (unauthenticated) connections cannot query anything.
        await db.query(`DEFINE USER OVERWRITE viewer ON DATABASE PASSWORD 'viewer' ROLES VIEWER`).collect()

        // Conditional frontend auth setup (password-protected access)
        if (config.surrealdbFrontendPass) {
            await db.query(FRONTEND_AUTH_SCHEMA).collect()
            await db
                .query(`UPSERT viewer:frontend SET name = 'frontend', pass = crypto::argon2::generate($pass)`, {
                    pass: config.surrealdbFrontendPass,
                })
                .collect()
            log.info("Schema migration completed (frontend auth enabled)")
        } else {
            // Clean up frontend auth if previously configured
            await db.query(`REMOVE ACCESS IF EXISTS frontend ON DATABASE`).collect()
            await db.query(`REMOVE TABLE IF EXISTS viewer`).collect()
            log.info("Schema migration completed (anonymous access via viewer user)")
        }
    } finally {
        await db.close()
    }
}
