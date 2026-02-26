/**
 * Schema for demo mode — same core tables and fields as production,
 * but with FULL permissions (auth is irrelevant in embedded mode)
 * and without ingestion_lock (no leader election in demo).
 */
export const DEMO_SCHEMA = `
DEFINE TABLE IF NOT EXISTS task SCHEMAFULL PERMISSIONS FULL;

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

DEFINE TABLE IF NOT EXISTS event SCHEMALESS PERMISSIONS FULL;

DEFINE INDEX OVERWRITE idx_event_task_id ON event FIELDS task_id;
DEFINE INDEX OVERWRITE idx_event_type ON event FIELDS event_type;
DEFINE INDEX OVERWRITE idx_event_timestamp ON event FIELDS timestamp;

DEFINE TABLE IF NOT EXISTS worker SCHEMALESS PERMISSIONS FULL;

DEFINE FIELD OVERWRITE status ON worker TYPE string DEFAULT "online";
DEFINE FIELD OVERWRITE missed_polls ON worker TYPE int DEFAULT 0;
DEFINE INDEX OVERWRITE idx_worker_last_updated ON worker FIELDS last_updated;
DEFINE INDEX OVERWRITE idx_worker_status ON worker FIELDS status;
`
