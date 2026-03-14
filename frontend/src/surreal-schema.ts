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
DEFINE FIELD OVERWRITE workflow_id ON task TYPE string;
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
DEFINE INDEX OVERWRITE idx_task_workflow_id ON task FIELDS workflow_id;
DEFINE INDEX OVERWRITE idx_task_last_updated ON task FIELDS last_updated;

DEFINE TABLE IF NOT EXISTS workflow SCHEMAFULL
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete NONE;

DEFINE FIELD OVERWRITE root_task_id ON workflow TYPE string;
DEFINE FIELD OVERWRITE root_task_type ON workflow TYPE option<string>;
DEFINE FIELD OVERWRITE aggregate_state ON workflow TYPE string;
DEFINE FIELD OVERWRITE first_seen_at ON workflow TYPE option<datetime>;
DEFINE FIELD OVERWRITE last_updated ON workflow TYPE option<datetime>;
DEFINE FIELD OVERWRITE task_count ON workflow TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE completed_count ON workflow TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE failure_count ON workflow TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE retry_count ON workflow TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE active_count ON workflow TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE worker_count ON workflow TYPE int DEFAULT 0;
DEFINE FIELD OVERWRITE latest_exception_preview ON workflow TYPE option<string>;

DEFINE INDEX OVERWRITE idx_workflow_last_updated ON workflow FIELDS last_updated;
DEFINE INDEX OVERWRITE idx_workflow_aggregate_state ON workflow FIELDS aggregate_state;

DEFINE TABLE IF NOT EXISTS workflow_task TYPE RELATION IN workflow OUT task SCHEMAFULL
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete NONE;

DEFINE FIELD OVERWRITE created_at ON workflow_task TYPE option<datetime>;
DEFINE FIELD OVERWRITE last_updated ON workflow_task TYPE option<datetime>;

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

interface BackfillTaskRecord {
    id: string | { toString(): string }
    type?: string | null
    state?: string | null
    root_id?: string | null
    worker?: string | null
    exception?: string | null
    sent_at?: string | null
    last_updated?: string | null
}

interface WorkflowSummarySeed {
    activeCount: number
    completedCount: number
    failureCount: number
    firstSeenAt: string | null
    lastUpdated: string | null
    latestExceptionPreview: string | null
    retryCount: number
    rootTaskId: string
    rootTaskType: string | null
    taskCount: number
    workerIds: Set<string>
}

const ACTIVE_STATES = new Set(["PENDING", "RECEIVED", "STARTED"])

const recordIdToPlainId = (id: string | { toString(): string }): string => {
    const value = String(id)
    const colonIdx = value.indexOf(":")
    const rawId = colonIdx >= 0 ? value.slice(colonIdx + 1) : value
    return rawId.replace(/^[<⟨'"]+|[>⟩'"]+$/g, "")
}

const compareMaybeIsoAsc = (left: string | null, right: string | null) => {
    if (left === right) return 0
    if (left == null) return 1
    if (right == null) return -1
    return left.localeCompare(right)
}

async function backfillWorkflows(db: Surreal, log: Logger): Promise<void> {
    const [tasks] = await db.query<[BackfillTaskRecord[]]>("SELECT * FROM task").collect()
    if (!Array.isArray(tasks) || tasks.length === 0) {
        return
    }

    const workflowIdsByTask = new Map<string, string>()
    const summaries = new Map<string, WorkflowSummarySeed>()

    for (const task of tasks) {
        const taskId = recordIdToPlainId(task.id)
        const workflowId = task.root_id || taskId
        workflowIdsByTask.set(taskId, workflowId)

        const existing = summaries.get(workflowId)
        const summary =
            existing ??
            {
                rootTaskId: workflowId,
                rootTaskType: null,
                taskCount: 0,
                completedCount: 0,
                failureCount: 0,
                retryCount: 0,
                activeCount: 0,
                workerIds: new Set<string>(),
                firstSeenAt: null,
                lastUpdated: null,
                latestExceptionPreview: null,
            }

        summary.taskCount += 1

        if (task.state === "FAILURE") summary.failureCount += 1
        if (task.state === "RETRY") summary.retryCount += 1
        if (task.state && ACTIVE_STATES.has(task.state)) summary.activeCount += 1
        if (task.state && !ACTIVE_STATES.has(task.state) && task.state !== "RETRY") summary.completedCount += 1
        if (task.worker) summary.workerIds.add(task.worker)

        const firstSeenCandidate = task.sent_at || task.last_updated || null
        if (compareMaybeIsoAsc(firstSeenCandidate, summary.firstSeenAt) < 0) {
            summary.firstSeenAt = firstSeenCandidate
        }
        if (compareMaybeIsoAsc(task.last_updated || null, summary.lastUpdated) > 0) {
            summary.lastUpdated = task.last_updated || null
            summary.latestExceptionPreview = task.exception || summary.latestExceptionPreview
        }

        if (taskId === workflowId) {
            summary.rootTaskType = task.type || summary.rootTaskType
        }

        summaries.set(workflowId, summary)
    }

    const updates = Array.from(workflowIdsByTask.entries())
    for (const chunkStart of Array.from({ length: Math.ceil(updates.length / 100) }, (_, index) => index * 100)) {
        const chunk = updates.slice(chunkStart, chunkStart + 100)
        await Promise.all(
            chunk.map(([taskId, workflowId]) =>
                db
                    .query("UPSERT type::record('task', $taskId) SET workflow_id = $workflowId", {
                        taskId,
                        workflowId,
                    })
                    .collect(),
            ),
        )
    }

    for (const [workflowId, summary] of summaries) {
        const aggregateState =
            summary.failureCount > 0
                ? "FAILURE"
                : summary.retryCount > 0
                  ? "RETRY"
                  : summary.activeCount > 0
                    ? "STARTED"
                    : summary.taskCount > 0
                      ? "SUCCESS"
                      : "PENDING"

        await db
            .query(
                `UPSERT type::record('workflow', $workflowId) SET
                    root_task_id = $rootTaskId,
                    root_task_type = $rootTaskType,
                    aggregate_state = $aggregateState,
                    first_seen_at = <datetime>$firstSeenAt,
                    last_updated = <datetime>$lastUpdated,
                    task_count = $taskCount,
                    completed_count = $completedCount,
                    failure_count = $failureCount,
                    retry_count = $retryCount,
                    active_count = $activeCount,
                    worker_count = $workerCount,
                    latest_exception_preview = $latestExceptionPreview`,
                {
                    workflowId,
                    rootTaskId: summary.rootTaskId,
                    rootTaskType: summary.rootTaskType,
                    aggregateState,
                    firstSeenAt: summary.firstSeenAt ?? summary.lastUpdated ?? new Date(0).toISOString(),
                    lastUpdated: summary.lastUpdated ?? summary.firstSeenAt ?? new Date(0).toISOString(),
                    taskCount: summary.taskCount,
                    completedCount: summary.completedCount,
                    failureCount: summary.failureCount,
                    retryCount: summary.retryCount,
                    activeCount: summary.activeCount,
                    workerCount: summary.workerIds.size,
                    latestExceptionPreview: summary.latestExceptionPreview,
                },
            )
            .collect()

        const memberTaskIds = Array.from(workflowIdsByTask.entries())
            .filter(([, taskWorkflowId]) => taskWorkflowId === workflowId)
            .map(([taskId]) => taskId)

        await Promise.all(
            memberTaskIds.map((taskId) =>
                db
                    .query(
                        `UPSERT type::record('workflow_task', $edgeId) SET
                            in = type::record('workflow', $workflowId),
                            out = type::record('task', $taskId)`,
                        {
                            edgeId: `${workflowId}:${taskId}`,
                            workflowId,
                            taskId,
                        },
                    )
                    .collect(),
            ),
        )
    }

    log.info(`Workflow backfill completed for ${summaries.size} workflows`)
}

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
        await backfillWorkflows(db, log)

        // Always create a read-only viewer user for the frontend.
        // SurrealDB requires authentication even for tables with FULL select permissions —
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
