# Migrate from In-Memory LRU + WebSocket to SurrealDB

## Context

The current architecture uses Celery's `State` LRU (10k tasks, 5k workers) in Python, synced to the frontend via custom WebSocket broadcasting into Zustand LRU stores (1k tasks, 100 workers). The inconsistent limits between server and client, heavy browser memory usage, and complex sync code make this fragile. Replacing it with SurrealDB gives us: a single source of truth, live queries instead of custom WebSocket sync, optional disk persistence, external hosting for scaled deployments, and a dramatically simpler data flow.

## Architecture Overview

```text
PRODUCTION:
  Bun (port 8555) — single entrypoint, owns all settings, orchestrates subprocesses
    ├── spawns SurrealDB server (port 8557)  [or connects to external]
    ├── spawns Python ingester (port 8556)   [only if ingestion enabled + leader elected]
    ├── proxies /api/* → Python (only when Python is running)
    ├── proxies /surreal/* → SurrealDB
    ├── serves SPA
    └── runs leader election against SurrealDB directly

  Python (database-level user "ingester" — bypasses table permissions):
    Pure ingestion process — only started by Bun when needed
    Celery Events → EventReceiver (thread) → async queue → SurrealDBIngester (batched writes)
    Task completion → fetch result from Redis → update task in SurrealDB
    Periodic worker poller → Celery inspect API → upsert workers in SurrealDB
    Periodic cleanup job → prune old tasks/events/workers by retention policy
    Receives SurrealDB + Celery connection details from Bun via env vars

  Frontend (anonymous by default, optional password protection):
    SurrealDB JS SDK → live queries → React components
    No Zustand state store, no custom WebSocket layer
    Default: anonymous read-only access (table permissions enforce read-only)
    Optional: if SURREALDB_FRONTEND_PASS is set, shows login dialog before connecting

READ-ONLY MODE (INGESTION_ENABLED=false):
  Bun (port 8555)
    ├── spawns SurrealDB server (or connects to external)
    ├── NO Python process
    ├── proxies /surreal/* → SurrealDB
    └── serves SPA
  Dashboard-only — reads existing data, no Celery connection needed

DEMO MODE:
  Browser only (no Python, no SurrealDB server)
    ├── SurrealDB WASM embedded (in-memory, lazy-loaded)
    ├── Demo event generator → inserts into embedded SurrealDB
    └── Same live query hooks → same components
```

## SurrealDB Schema

```sql
DEFINE NAMESPACE celery_insights;
DEFINE DATABASE main;

-- Authentication: Python backend (write access, bypasses table permissions)
DEFINE USER ingester ON DATABASE PASSWORD $ingester_pass ROLES OWNER;

-- Authentication: Frontend (optional — only defined when SURREALDB_FRONTEND_PASS is set)
-- When not set: frontend connects anonymously, table permissions enforce read-only
-- When set: frontend must authenticate via record access before querying
--
-- Conditionally created by Bun during schema migration:
-- DEFINE ACCESS frontend ON DATABASE TYPE RECORD
--   SIGNUP NONE
--   SIGNIN (
--     SELECT * FROM viewer WHERE name = $name AND crypto::argon2::compare(pass, $pass)
--   )
-- ;
-- CREATE viewer:frontend SET name = 'frontend', pass = crypto::argon2::generate($frontend_pass);

-- Tasks: aggregated from events, upserted on each event
DEFINE TABLE task SCHEMAFULL
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete NONE
;
DEFINE FIELD type ON task TYPE option<string>;
DEFINE FIELD state ON task TYPE string;
DEFINE FIELD sent_at ON task TYPE option<datetime>;
DEFINE FIELD received_at ON task TYPE option<datetime>;
DEFINE FIELD started_at ON task TYPE option<datetime>;
DEFINE FIELD succeeded_at ON task TYPE option<datetime>;
DEFINE FIELD failed_at ON task TYPE option<datetime>;
DEFINE FIELD retried_at ON task TYPE option<datetime>;
DEFINE FIELD revoked_at ON task TYPE option<datetime>;
DEFINE FIELD rejected_at ON task TYPE option<datetime>;
DEFINE FIELD runtime ON task TYPE option<float>;
DEFINE FIELD last_updated ON task TYPE datetime;
DEFINE FIELD args ON task TYPE option<string>;
DEFINE FIELD kwargs ON task TYPE option<string>;
DEFINE FIELD eta ON task TYPE option<string>;
DEFINE FIELD expires ON task TYPE option<string>;
DEFINE FIELD retries ON task TYPE option<int>;
DEFINE FIELD exchange ON task TYPE option<string>;
DEFINE FIELD routing_key ON task TYPE option<string>;
DEFINE FIELD root_id ON task TYPE option<string>;
DEFINE FIELD parent_id ON task TYPE option<string>;
DEFINE FIELD children ON task TYPE array<string> DEFAULT [];
DEFINE FIELD worker ON task TYPE option<string>;
DEFINE FIELD result ON task TYPE option<string>;
DEFINE FIELD result_truncated ON task TYPE bool DEFAULT false;  -- true if result exceeded 100KB and was truncated
DEFINE FIELD exception ON task TYPE option<string>;
DEFINE FIELD traceback ON task TYPE option<string>;

DEFINE INDEX idx_task_state ON task FIELDS state;
DEFINE INDEX idx_task_type ON task FIELDS type;
DEFINE INDEX idx_task_worker ON task FIELDS worker;
DEFINE INDEX idx_task_root_id ON task FIELDS root_id;
DEFINE INDEX idx_task_last_updated ON task FIELDS last_updated;

-- Raw events: append-only log, SCHEMALESS because fields vary by Celery version
DEFINE TABLE event SCHEMALESS
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete NONE
;
-- Only index fields we know exist across versions
DEFINE INDEX idx_event_task_id ON event FIELDS task_id;
DEFINE INDEX idx_event_type ON event FIELDS event_type;
DEFINE INDEX idx_event_timestamp ON event FIELDS timestamp;

-- Workers: SCHEMALESS because fields vary by Celery version and inspect API response
DEFINE TABLE worker SCHEMALESS
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete NONE
;
DEFINE FIELD status ON worker TYPE string DEFAULT "online";  -- "online" | "offline"
DEFINE FIELD missed_polls ON worker TYPE int DEFAULT 0;      -- consecutive inspect failures, offline after 3
DEFINE INDEX idx_worker_last_updated ON worker FIELDS last_updated;
DEFINE INDEX idx_worker_status ON worker FIELDS status;

-- Ingestion lock: ensures only one Python backend ingests at a time (multi-instance support)
DEFINE TABLE ingestion_lock SCHEMAFULL
  PERMISSIONS
    FOR select FULL
    FOR create, update, delete NONE
;
DEFINE FIELD holder ON ingestion_lock TYPE string;          -- instance ID (hostname:pid:random)
DEFINE FIELD acquired_at ON ingestion_lock TYPE datetime;
DEFINE FIELD heartbeat ON ingestion_lock TYPE datetime;
DEFINE FIELD ttl_seconds ON ingestion_lock TYPE int DEFAULT 30;
```

Record IDs: `task:celery_task_uuid`, `worker:hostname_pid`, `event:ulid()`, `ingestion_lock:leader` (singleton).

## [ ] Phase 1: Infrastructure

### [x] 1a. Settings

Settings are split across Bun (orchestration) and Python (ingestion internals). Bun owns all top-level config, validates it at startup using **Zod**, and propagates what Python needs via environment variables when spawning the subprocess.

#### [x] Bun settings (`frontend/src/config.ts` — validated with Zod)

All env vars are parsed and validated at Bun startup using a Zod schema. Invalid config fails fast with clear error messages before any subprocess is spawned.

```typescript
import { z } from "zod"

const configSchema = z.object({
    // Server
    port: z.coerce.number().int().positive().default(8555),

    // SurrealDB
    surrealdbUrl: z.string().url().default("ws://localhost:8557/rpc"),
    surrealdbExternalUrl: z.string().url().optional(),         // if set, skip spawning SurrealDB
    surrealdbIngesterPass: z.string().min(1).default("changeme"),
    surrealdbFrontendPass: z.string().min(1).optional(),          // undefined = anonymous access (no auth)
    surrealdbNamespace: z.string().min(1).default("celery_insights"),
    surrealdbDatabase: z.string().min(1).default("main"),
    surrealdbStorage: z.string().default("memory"),            // "memory", "rocksdb://path", "surrealkv://path"
    surrealdbPort: z.coerce.number().int().positive().default(8557),

    // Ingestion control
    ingestionEnabled: z.coerce.boolean().default(true),
    ingestionLeaderElection: z.coerce.boolean().default(true),
    ingestionLockTtlSeconds: z.coerce.number().int().positive().default(30),
    ingestionLockHeartbeatSeconds: z.coerce.number().int().positive().default(10),

    // Data retention (passed to Python)
    cleanupIntervalSeconds: z.coerce.number().int().positive().default(60),
    taskMaxCount: z.coerce.number().int().positive().optional(), // undefined = unlimited
    taskRetentionHours: z.coerce.number().positive().optional(),
    deadWorkerRetentionHours: z.coerce.number().positive().optional().default(24),

    // Ingestion performance
    ingestionBatchIntervalMs: z.coerce.number().int().positive().default(100),

    // Celery connection (passed to Python)
    brokerUrl: z.string().default("amqp://guest:guest@host.docker.internal/"),
    resultBackend: z.string().default("redis://host.docker.internal:6379/0"),
    configFile: z.string().default("/app/config.py"),
    timezone: z.string().default("UTC"),
    debug: z.coerce.boolean().default(false),
}).refine(
    (c) => c.ingestionLockHeartbeatSeconds < c.ingestionLockTtlSeconds,
    { message: "INGESTION_LOCK_HEARTBEAT_SECONDS must be less than INGESTION_LOCK_TTL_SECONDS" },
)

// Parse from env (SCREAMING_SNAKE_CASE → camelCase mapping)
export const config = configSchema.parse(envToConfig(process.env))
```

The `envToConfig` helper maps `SURREALDB_PORT` → `surrealdbPort`, `INGESTION_ENABLED` → `ingestionEnabled`, etc. This gives us:

- Type-safe config object used throughout `bun-entry.ts`
- Fail-fast on invalid env vars (e.g., non-numeric port, heartbeat >= TTL)
- Clear defaults documented in one place
- No scattered `process.env` access

Bun reads these, uses the orchestration settings itself (SurrealDB spawning, leader election, whether to spawn Python), and forwards the relevant subset to Python as env vars when spawning the subprocess.

#### [x] Python settings (`server/settings.py` — receives from Bun via env vars)

Python settings become simpler — only what the ingester needs at runtime:

```python
# SurrealDB connection (received from Bun)
surrealdb_url: str = "ws://localhost:8557/rpc"
surrealdb_ingester_pass: str = "changeme"
surrealdb_namespace: str = "celery_insights"
surrealdb_database: str = "main"

# Celery connection (received from Bun)
broker_url: str = "amqp://guest:guest@host.docker.internal/"
result_backend: str = "redis://host.docker.internal:6379/0"
config_path: str = "/app/config.py"
timezone: str = "UTC"
debug: bool = False

# Data retention (received from Bun)
cleanup_interval_seconds: int = 60
task_max_count: int | None = 10_000
task_retention_hours: int | None = None
dead_worker_retention_hours: int | None = 24

# Ingestion performance (received from Bun)
ingestion_batch_interval_ms: int = 100

# Server (Python always listens on an internal port, set by Bun)
host: str = "0.0.0.0"
port: int = 8556
```

Python no longer knows or cares about leader election, SurrealDB spawning, frontend passwords, or storage mode — Bun handles all of that.

### [x] 1b. Ingestion leader election (`frontend/bun-entry.ts`)

When multiple Celery Insights instances share the same SurrealDB (e.g., HA deployment or multiple developers pointing at a shared DB), only one should run the ingestion pipeline. Otherwise events get written twice.

Leader election runs in **Bun**, not Python. Bun connects to SurrealDB directly (using the `surrealdb` JS SDK) to manage the lock, and only spawns the Python ingester subprocess if it wins the election.

**Two controls:**

1. **Manual toggle** (`INGESTION_ENABLED=false`): Bun never spawns Python at all. The instance is a pure read-only dashboard — serves the SPA, proxies to SurrealDB, nothing else. No Celery connection needed.

2. **Automatic leader election** (`INGESTION_LEADER_ELECTION=true`, default): Bun uses a `ingestion_lock:leader` record in SurrealDB as a distributed lock. Only the lock holder spawns Python.

**Leader election protocol (runs in Bun):**

```
Bun startup (generates unique instance_id = `${hostname}:${pid}:${randomSuffix}`):

1. Start SurrealDB subprocess (or connect to external)
2. Connect to SurrealDB as ingester user
3. Run schema migration (idempotent)
4. If INGESTION_ENABLED is false → log "Read-only mode", skip to step 7
5. If INGESTION_LEADER_ELECTION is false → spawn Python immediately, skip to step 7
6. Try to acquire lock (atomic — avoids TOCTOU race between multiple standbys):
   a. Attempt atomic upsert:
      ```sql
      -- Tries to create if no record exists, or take over a stale lock, in one statement.
      -- Returns the updated record only if this instance won.
      UPDATE ingestion_lock:leader
        SET holder = $id, acquired_at = time::now(), heartbeat = time::now()
        WHERE holder = NONE                                       -- no record yet (upsert)
           OR holder = $id                                        -- we already hold it
           OR heartbeat < time::now() - $ttl_seconds * 1s         -- stale lock
      ```
   b. Check returned record: if `holder = $id` → acquired
      → Spawn Python subprocess, start heartbeat loop
   c. If no record returned (another instance holds a fresh lock):
      → SELECT ingestion_lock:leader to learn who the leader is
      → Enter standby mode (periodic re-check every ttl_seconds)
      → Log: "Standby mode — instance {holder} is ingesting"
7. Start serving SPA + proxying /surreal/*
8. If Python is running, also proxy /api/* → Python

Leader responsibilities (Bun manages):
  - Refresh heartbeat every INGESTION_LOCK_HEARTBEAT_SECONDS (default 10s):
    UPDATE ingestion_lock:leader SET heartbeat = time::now() WHERE holder = $id
  - Monitor Python subprocess health — if it crashes, restart it (leader keeps the lock)
  - On graceful shutdown (SIGTERM/SIGINT):
    1. Kill Python subprocess
    2. DELETE ingestion_lock:leader WHERE holder = $id
    (allows standby to take over immediately instead of waiting for TTL)

Standby behavior (Bun manages):
  - Every ttl_seconds, re-check the lock (step 6 above)
  - If lock becomes stale or deleted → acquire lock, spawn Python
  - Log: "Promoted to leader — starting ingestion"
```

**What gets gated by the lock (all in Python, spawned by Bun):**

- The entire Python subprocess (EventReceiver, SurrealDBIngester, WorkerPoller, CleanupJob, ResultFetcher)

**What always runs regardless (all in Bun):**

- SurrealDB subprocess management
- SPA serving
- `/surreal/*` proxy to SurrealDB (frontend data access)
- `/api/config` endpoint (frontend configuration — auth mode, ingestion status)
- Schema migration and conditional auth setup

### [x] 1c. Bun subprocess management (`frontend/bun-entry.ts`)

Bun is now the full orchestrator — it manages both subprocesses and decides what to start:

**SurrealDB subprocess:**

- Spawn: `surreal start --bind 0.0.0.0:${SURREALDB_PORT} --user root --pass root ${SURREALDB_STORAGE}`
- Skip spawning if `SURREALDB_EXTERNAL_URL` is set
- If subprocess crashes, restart with exponential backoff

**Python ingester subprocess:**

- Only spawned if Bun wins the leader election (or election is disabled and ingestion is enabled)
- Spawned with env vars forwarded: `SURREALDB_URL`, `SURREALDB_INGESTER_PASS`, `SURREALDB_NAMESPACE`, `SURREALDB_DATABASE`, `BROKER_URL`, `RESULT_BACKEND`, `CONFIG_FILE`, `TIMEZONE`, `DEBUG`, retention settings, batch interval
- If Python crashes while Bun is still leader, restart it (Bun keeps the lock)
- Not spawned at all in read-only mode (`INGESTION_ENABLED=false`)

**Signal handling (SIGTERM/SIGINT):**

1. Release ingestion lock (if held)
2. Kill Python subprocess (if running)
3. Kill SurrealDB subprocess (if managed)

**Proxy routes:**

- `/surreal/*` → `ws://localhost:${SURREALDB_PORT}/*` (always active — frontend data access)
- `/api/*` → `http://localhost:8556/*` (only active when Python is running)
- `/health` → responds directly from Bun with status of subprocesses + leader election state

**Bun-served endpoints (always available, no Python needed):**

- `GET /api/config` → returns frontend configuration:

  ```json
  {
    "authRequired": true | false,
    "surrealPath": "/surreal/rpc",
    "ingestionStatus": "leader" | "standby" | "read-only" | "disabled"
  }
  ```

  The frontend fetches this on mount to decide whether to show the login dialog and to display ingestion status. This avoids embedding secrets in HTML or guessing auth state.

**SPA serving:**

- Static assets with cache headers (same as current)
- SPA fallback for all other routes

### [x] 1d. Vite dev proxy (`frontend/vite.config.ts`)

Add proxy rule: `/surreal` → `ws://localhost:8557` (for dev mode).

Add `package.json` scripts:

- `"dev:surreal": "surreal start --bind 0.0.0.0:8557 --user root --pass root memory"` — start SurrealDB standalone
- `"dev:all": "concurrently \"bun run dev:surreal\" \"cd ../server && python run.py\" \"bun dev\""` — start all three processes in one terminal for convenience

### [x] 1e. Docker (`Dockerfile`)

- Add SurrealDB binary to the Docker image (download from GitHub releases or use official install script)
- Pin to a specific SurrealDB v2.x minor version (e.g., `v2.1.x`) — SurrealDB's API has broken between minors before
- Expose storage volume mount point for persistent mode (`/data` default)

### [x] 1f. SurrealDB client module (`server/surrealdb_client.py`)

Python-side SurrealDB client — used only by the ingestion pipeline:

- Singleton async connection using `AsyncSurreal`
- Connect as `ingester` user (credentials received via env vars from Bun), select namespace/database
- Expose `get_db()` dependency for use in lifespan and services
- Reconnection logic: on connection loss, retry with exponential backoff (1s, 2s, 4s, max 30s)
- No schema migration here — Bun handles that before spawning Python

### [x] 1g. Schema migration and auth setup (runs in Bun)

Bun runs schema migration **before** spawning Python or starting the leader election, using the SurrealDB JS SDK:

- Contains all DEFINE TABLE/FIELD/INDEX/ACCESS statements including `ingestion_lock` table
- Idempotent — uses DEFINE ... OVERWRITE or IF NOT EXISTS
- Creates `ingester` DB user (always — Python needs write access)
- **Conditional auth setup**: only if `SURREALDB_FRONTEND_PASS` is set:
  - DEFINE ACCESS `frontend` record access method with SIGNIN query
  - Seed `viewer:frontend` record with hashed password
  - If not set: skip auth setup entirely — frontend connects anonymously, table permissions (SELECT FULL) enforce read-only
- Runs with root credentials (only Bun knows root password)
- Lives in a module like `frontend/src/surreal-schema.ts` or inline in `bun-entry.ts`

**Files to create:** `server/surrealdb_client.py`, `frontend/src/config.ts` (Zod schema), `frontend/src/surreal-schema.ts`, `frontend/src/leader-election.ts`
**Files to modify:** `server/settings.py`, `frontend/bun-entry.ts`, `frontend/vite.config.ts`, `Dockerfile`, `frontend/package.json` (dev:surreal script, surrealdb + zod + concurrently dependencies)

## [ ] Phase 2: Python Ingestion

### [x] 2a. Replace EventBroadcaster with SurrealDB ingester (`server/events/broadcaster.py`)

Current flow: event → `state.event()` → `Task.from_celery_task()` → WebSocket broadcast
New flow: event → async queue → batch accumulator → SurrealDB upsert

The broadcaster becomes a `SurrealDBIngester`:

- Accumulates events in a buffer, flushes every `ingestion_batch_interval_ms` (default 100ms) or when buffer reaches a size threshold (500 events)
- **Immediate flush** for terminal state events (SUCCESS, FAILURE, REVOKED, REJECTED) — users are typically waiting on these
- On flush, executes batched writes in a single SurrealDB transaction (preserving within-batch ordering):
  - Task events: conditional upsert (see out-of-order handling below)
  - Worker events: `UPDATE worker:$worker_id MERGE { ... }`
  - Raw events: `CREATE event SET task_id = $tid, event_type = $type, timestamp = $ts, data = $raw`
- Special handling for `children` field: use `array::union(children, [$child_id])` instead of MERGE to avoid replacing the array
- **Out-of-order event handling**: Celery events can arrive out of order (e.g., `task-succeeded` before `task-started`). Simple MERGE would let a late `task-received` overwrite a `task-started` state. Use conditional SET logic:

  ```sql
  UPDATE task:$task_id SET
    -- State: only advance forward, never regress (use last_updated as proxy for event ordering)
    state = IF $event_ts > last_updated THEN $state ELSE state END,
    -- Timestamp fields: only set if not already set (idempotent) or if new value is earlier (correcting order)
    started_at = IF started_at == NONE OR $ts < started_at THEN $ts ELSE started_at END,
    -- last_updated: always take the latest
    last_updated = IF $event_ts > last_updated THEN $event_ts ELSE last_updated END,
    -- Other fields from this event: only set if we're the latest event
    worker = IF $event_ts >= last_updated THEN $worker ELSE worker END,
    ...
  ```

- **Event buffer backpressure**: if the async queue exceeds 10,000 pending events (e.g., SurrealDB is down), drop oldest events and log a warning. This prevents unbounded memory growth during outages. The backpressure threshold is logged so operators can tune `ingestion_batch_interval_ms` if they see drops.

### [x] 2b. Task result fetcher (`server/tasks/result_fetcher.py`)

- When a task reaches terminal state (SUCCESS, FAILURE, REVOKED, REJECTED, RETRY):
  - Fetch result/exception/traceback from Celery result backend via `AsyncResult` (in thread via `asyncio.to_thread`)
  - Update the task record in SurrealDB: `UPDATE task:$id SET result = $result, exception = $exc, traceback = $tb`
- Run as an async task triggered by the ingester when it detects a terminal state event
- **Result size limit**: truncate results larger than 100KB before storing in SurrealDB, with a `result_truncated: true` flag. Celery results can be arbitrarily large (DataFrames, file contents); storing them all would bloat the database. The full result remains available in the Celery result backend.
- Gracefully handle result backend unavailability (log warning, skip)

### [x] 2c. Worker periodic poller (`server/workers/poller.py`)

- Async loop running every N seconds (configurable, default 5s)
- Calls Celery inspect API (via `asyncio.to_thread`): `inspect.stats()`, `inspect.active()`, `inspect.registered()`, `inspect.scheduled()`, `inspect.reserved()`, `inspect.active_queues()`
- Upserts results into SurrealDB worker records: all inspect data stored as fields on the schemaless worker record
- **Offline detection**: compares current inspect response hostnames against known workers in SurrealDB. Tracks a `missed_polls` counter per worker — only marks a worker offline after **3 consecutive** missed polls (`UPDATE worker:$id SET status = "offline"`). This avoids false positives from transient network issues, broker hiccups, or workers busy with long-running tasks. The counter resets to 0 when the worker responds.
- Started/stopped in lifespan

### [x] 2d. Data cleanup job (`server/cleanup.py`)

SurrealDB has no native TTL, cron, or retention policies. Cleanup must be triggered externally.

- Periodic async task in Python (runs every `cleanup_interval_seconds`, default 60s)
- **Task cleanup** (includes cascading delete of related events):
  - Count-based: if `task_max_count` is set and count exceeds it, delete oldest tasks by `last_updated` and their related events
  - Time-based: if `task_retention_hours` is set, delete tasks older than the threshold and their related events
  - Both can be active simultaneously; either `None` disables that policy
- **Dead worker cleanup**:
  - If `dead_worker_retention_hours` is set (default 24h), delete workers with `status = "offline"` whose `last_updated` is older than the threshold
- All policies are optional — setting all to `None` disables cleanup entirely (data grows on disk)
- Started/stopped in lifespan

### [x] 2e. Remove old state management

- Remove `from celery.events.state import State` from receiver
- EventReceiver still captures events and puts them on the asyncio Queue (this thread→async bridge stays)
- Remove WebSocket managers (`server/ws/managers.py`, `server/ws/websocket_manager.py`, `server/ws/router.py`, `server/ws/models.py`)
- Remove REST endpoints that read from state:
  - `GET /api/tasks` — remove (frontend queries SurrealDB directly)
  - `GET /api/tasks/{id}` — remove
  - `GET /api/tasks/{id}/result` — remove (result stored in SurrealDB)
  - `GET /api/workers` — remove
  - `GET /api/workers/stats`, `/active`, `/registered`, `/revoked`, `/scheduled`, `/reserved`, `/queues` — remove (data in SurrealDB via poller)
  - `GET /api/events` — remove (frontend queries SurrealDB directly)
  - `GET /api/search` — remove (frontend searches SurrealDB directly)
- Remove `server/search/` module entirely (search moves to frontend)

### [x] 2f. Update settings / server info endpoints

Remaining Python REST endpoints (only served when Python is running):

- `GET /health` — returns Python process health + SurrealDB connection status
- `GET /api/settings/info` — update `ServerInfo.create()` to query SurrealDB for task/worker counts (`SELECT count() FROM task`, `SELECT count() FROM worker`)
- `GET /api/settings/clients` — remove (no WebSocket clients to track)
- `POST /api/settings/clear` — update to truncate SurrealDB tables: `DELETE FROM task; DELETE FROM event; DELETE FROM worker;`
- `POST /api/settings/download-debug-bundle` — update state dump to query SurrealDB: `SELECT * FROM task`, `SELECT * FROM worker`. Remove connection dump. Add SurrealDB connection status + leader election state to bundle.
- `/docs`, `/redoc`, `/openapi.json` — keep (fewer endpoints now)

Note: Bun also responds to `/health` directly (always available, even in read-only mode) with subprocess statuses and leader election state. The Python `/health` is proxied via `/api/health` when Python is running.

### [x] 2g. Update Python lifespan (`server/lifespan.py`)

Python's lifespan is now much simpler — Bun has already handled leader election and decided to spawn Python, so Python just starts ingesting:

Startup sequence:

1. Initialize SurrealDB connection (as `ingester` user, credentials from env vars)
2. Connect to Celery broker
3. Start: EventReceiver → SurrealDBIngester → WorkerPoller → CleanupJob

Shutdown sequence (reverse):

1. Stop CleanupJob → WorkerPoller → SurrealDBIngester → EventReceiver
2. Close SurrealDB connection

Python no longer manages leader election, schema migration, or standby mode — all of that is Bun's responsibility.

**Files to create:** `server/tasks/result_fetcher.py`, `server/workers/poller.py`, `server/cleanup.py`
**Files to modify:** `server/events/broadcaster.py`, `server/events/receiver.py`, `server/lifespan.py`, `server/server_info/router.py`, `server/server_info/models.py`, `server/server_info/debug_bundle.py`, `server/app.py` (remove routers)
**Files to remove:** `server/ws/managers.py`, `server/ws/websocket_manager.py`, `server/ws/router.py`, `server/ws/models.py`, `server/tasks/router.py`, `server/workers/router.py`, `server/workers/dependencies.py`, `server/search/router.py`, `server/search/search.py`, `server/events/router.py`, `server/pagination.py`

## [ ] Phase 3: Frontend Data Layer

### [x] 3a. SurrealDB provider (`frontend/app/components/surrealdb-provider.tsx`)

- React context providing the SurrealDB connection instance
- **On mount**: fetches `GET /api/config` to determine auth mode and ingestion status
- **Production (no auth)**: connects anonymously to `ws://${location.host}/surreal/rpc` — table permissions enforce read-only
- **Production (auth required)**: shows a fullscreen login dialog with a single password field:
  - User enters password → authenticate via SurrealDB record access method (`SIGNIN` as `viewer:frontend`)
  - On success → store token in `sessionStorage` (survives page refresh, clears on tab close), connect, render dashboard
  - On failure → show inline error ("Invalid password"), stay on dialog
  - On subsequent loads → check `sessionStorage` for existing token → try reconnect → if expired/invalid, show dialog again
- **Demo**: lazy-loads SurrealDB WASM, connects to `mem://`, runs schema initialization in-browser (no auth needed — permissions irrelevant in embedded mode)
- Connection lifecycle: connect on mount, close on unmount
- Exposes `useSurrealDB()` hook for raw client access
- **Connection status**: exposes `{ connected, reconnecting, error, ingestionStatus }` state for UI indicators

### [x] 3b. Generic `useLiveQuery` hook (`frontend/app/hooks/use-live-query.ts`)

**Important**: SurrealDB `LIVE SELECT` does NOT support `ORDER BY`, `LIMIT`, or `GROUP BY`. The hook must work around this with a two-phase pattern:

```typescript
function useLiveQuery<T>(options: {
    // Initial data fetch — supports full SurrealQL (ORDER, LIMIT, GROUP, etc.)
    initialQuery: string
    // Live subscription — must be a simple LIVE SELECT (no ORDER/LIMIT/GROUP)
    liveTable: string
    liveCondition?: string  // optional WHERE clause for filtering notifications
    bindings?: Record<string, unknown>
    // Client-side ordering/limiting applied after live patches
    orderBy?: (a: T, b: T) => number
    limit?: number
}): {
    data: T[]
    isLoading: boolean
    error: Error | null
}
```

Behavior:

1. Run `initialQuery` (full SELECT with ORDER/LIMIT) to populate initial state
2. Start `LIVE SELECT * FROM $liveTable [WHERE $liveCondition]` for real-time notifications
3. On CREATE notification → insert into local array, re-sort, apply limit
4. On UPDATE notification → replace matching record, re-sort
5. On DELETE notification → remove from local array
6. Clean up subscription on unmount (`db.kill(uuid)`)

**Reconnection recovery** (critical — live subscriptions are lost on disconnect):

1. Listen for SurrealDB connection state changes from the provider
2. On reconnect → re-run `initialQuery` to catch events missed during the outage, then re-subscribe `LIVE SELECT`
3. Show a brief toast notification: "Connection restored — data is up to date"
4. During disconnection, show a subtle inline indicator on components using live data (e.g., dimmed overlay or "Data may be stale" badge)

### [x] 3c. Specific live query hooks (`frontend/app/hooks/use-live-*.ts`)

Each hook wraps `useLiveQuery` with domain-specific queries:

```typescript
// Recent tasks for homepage — initial query has ORDER + LIMIT, live sub is unordered
useLiveTasks(limit = 30)
  initialQuery: "SELECT * FROM task ORDER BY last_updated DESC LIMIT $limit"
  liveTable: "task"
  orderBy: (a, b) => b.last_updated - a.last_updated
  limit: 30

// Tasks for a specific worker
useWorkerTasks(workerId: string)
  initialQuery: "SELECT * FROM task WHERE worker = $workerId ORDER BY last_updated DESC"
  liveTable: "task"
  liveCondition: "worker = $workerId"
  orderBy: (a, b) => b.last_updated - a.last_updated

// Workflow tasks (by root_id)
useWorkflowTasks(rootTaskId: string)
  initialQuery: "SELECT * FROM task WHERE root_id = $rootId OR id = task:$rootId"
  liveTable: "task"
  // Filter in notification handler: only keep if root_id matches or id matches

// Single task detail
useTask(taskId: string)
  initialQuery: "SELECT * FROM task:$taskId"
  liveTable: "task"
  liveCondition: "id = task:$taskId"

// All workers
useLiveWorkers()
  initialQuery: "SELECT * FROM worker ORDER BY last_updated DESC"
  liveTable: "worker"
  orderBy: (a, b) => b.last_updated - a.last_updated

// Single worker detail (all inspect data inline)
useWorker(workerId: string)
  initialQuery: "SELECT * FROM worker:$workerId"
  liveTable: "worker"
  liveCondition: "id = worker:$workerId"

// Online workers — filter by status field (set by backend poller)
useOnlineWorkers()
  initialQuery: "SELECT * FROM worker WHERE status = 'online'"
  liveTable: "worker"
  // Client-side filter: only include records with status = "online"

// Raw events for raw events page
useLiveEvents(limit = 100)
  initialQuery: "SELECT * FROM event ORDER BY timestamp DESC LIMIT $limit"
  liveTable: "event"
  orderBy: (a, b) => b.timestamp - a.timestamp
  limit: 100

// Events for a specific task
useTaskEvents(taskId: string)
  initialQuery: "SELECT * FROM event WHERE task_id = $taskId ORDER BY timestamp"
  liveTable: "event"
  liveCondition: "task_id = $taskId"
  orderBy: (a, b) => a.timestamp - b.timestamp

// Exceptions summary — initial query uses GROUP BY, live updates re-aggregate client-side
useExceptionsSummary()
  initialQuery: "SELECT exception, count() AS count FROM task WHERE exception != NONE GROUP BY exception ORDER BY count DESC"
  // Does NOT use standard useLiveQuery — uses a custom hook:
  // 1. Runs initial aggregation query
  // 2. Subscribes to LIVE SELECT * FROM task
  // 3. On any task CREATE/UPDATE, re-runs the aggregation query (debounced, e.g. every 2s)

// Explorer — server-side filtering/pagination via SurrealDB queries
// Does NOT use useLiveQuery — uses a custom hook with live-refreshing results
useExplorerTasks(filters: ExplorerFilters, sort: SortConfig, page: number, pageSize = 50)
  // Builds a SurrealQL query from the active facet filters:
  // "SELECT * FROM task WHERE state IN $states AND type IN $types AND worker IN $workers
  //  ORDER BY $sortField $sortDir LIMIT $pageSize START $offset"
  // Also runs: "SELECT state, count() AS count FROM task GROUP BY state" (etc.) for facet counts
  // Subscribes to LIVE SELECT * FROM task — on any notification, re-runs both queries (debounced 500ms)
  // This pushes filtering to SurrealDB (indexed!) instead of loading 10k records into the browser
```

### [x] 3d. Search via SurrealDB (`frontend/app/hooks/use-search.ts`)

Replace the REST `/api/search` endpoint with a direct SurrealDB query from the frontend:

```typescript
useSearch(query: string, limit = 10)
  // Debounce input by 300ms, then run:
  "SELECT * FROM task WHERE
    string::contains(string::lowercase(id), $q)
    OR string::contains(string::lowercase(type ?? ''), $q)
    OR string::contains(string::lowercase(exception ?? ''), $q)
  ORDER BY last_updated DESC LIMIT $limit"
  +
  "SELECT * FROM worker WHERE
    string::contains(string::lowercase(id), $q)
  ORDER BY last_updated DESC LIMIT $limit"
```

Returns `{ tasks: Task[], workers: Worker[], isLoading: boolean }`.

**Performance note**: `string::contains` on unindexed fields is a full table scan. For the initial migration this is acceptable (search is debounced + limited). If performance becomes an issue at scale, add SurrealDB full-text search indexes:

```sql
DEFINE ANALYZER task_analyzer TOKENIZERS blank, class FILTERS lowercase, ascii;
DEFINE INDEX idx_task_search ON task FIELDS type SEARCH ANALYZER task_analyzer BM25;
```

Then switch to `search::score()` / `@@` syntax. Defer this to post-migration optimization.

### [x] 3e. Connection & ingestion status component (`frontend/app/components/connection-status.tsx`)

Replace the current WebSocket status indicator with a combined SurrealDB + ingestion status:

**Connection status:**

- **Connected**: green indicator, live queries active
- **Reconnecting**: yellow indicator with "Reconnecting..." text
- **Disconnected**: red indicator with error details and retry countdown
- On reconnect recovery: show toast "Connection restored — data is up to date"

**Ingestion status** (from `ingestionStatus` in `/api/config`):

- **Leader**: green — "Ingesting" (normal operation)
- **Standby**: blue — "Standby — another instance is ingesting"
- **Read-only**: amber banner — "Read-only mode — viewing existing data, no live ingestion"
- **Disabled**: gray — "Ingestion disabled"

The read-only mode banner is especially important — without it, users would wonder why no new tasks are appearing.

Uses the `{ connected, reconnecting, error, ingestionStatus }` state from `SurrealDBProvider`.

### [x] 3f. Update components

Replace all `useStateStore` selectors with live query hooks:

| Component | Current | New |
|---|---|---|
| `recent-tasks-panel.tsx` | `useStateStore(s => s.recentTaskIds)` | `useLiveTasks(30)` |
| `explorer.tsx` | `useStateStore(s => s.tasks.forEach(...))` | `useExplorerTasks(filters, sort, page)` |
| `worker-summary.tsx` | `useStateStore(s => tasks filtered by worker)` | `useWorkerTasks(id)` |
| `workflow-graph.tsx` | `useStateStore(s => filter by rootId, shallow)` | `useWorkflowTasks(rootId)` |
| `tasks.$taskId.tsx` | `useTaskState(id)` + `useTaskResult(id)` | `useTask(id)` (result is inline) |
| `workers.$workerId.tsx` | `useStateStore` + `useWorkerStats` + `useWorkerActiveTasks` etc. | `useWorker(id)` (all inspect data inline) |
| `exceptions-summary.tsx` | `useStateStore(aggregate exceptions)` | `useExceptionsSummary()` |
| `raw_events.tsx` | `useRawEvents()` custom WS hook | `useLiveEvents(100)` |
| Online workers check | `useOnlineWorkerIds()` | `useOnlineWorkers()` |
| Search | `GET /api/search` via React Query | `useSearch(query)` direct to SurrealDB |

### [x] 3g. Remove old sync layer

- Remove `frontend/app/stores/use-state-store.ts` + `use-state-store.test.ts`
- Remove `frontend/app/components/celery-state-sync.tsx`
- Remove `frontend/app/utils/translate-server-models.ts`
- Remove `frontend/app/hooks/use-raw-events.ts`
- Remove `frontend/app/hooks/use-client.ts`
- Remove `frontend/app/hooks/task/use-task-state.ts`
- Remove `frontend/app/hooks/task/use-task-result.ts`
- Remove `frontend/app/hooks/worker/use-online-worker-ids.ts`
- Remove `frontend/app/hooks/worker/use-worker-stats.ts`, `use-worker-queues.ts`, `use-worker-active-tasks.ts`, `use-worker-scheduled-tasks.ts`, `use-worker-reserved-tasks.ts`, `use-worker-revoked-tasks.ts`, `use-worker-registered-tasks.ts`
- Remove `frontend/app/services/server/` (auto-generated OpenAPI client — most endpoints gone)
- Remove `frontend/app/services/demo/demo-client.ts`
- Remove `frontend/app/utils/web-socket-utils.ts`
- Remove `lru-cache` dependency from `package.json`
- Remove `react-use-websocket` dependency from `package.json`
- Remove `openapi-typescript-codegen` dev dependency (or keep if settings endpoints remain)
- Consider removing TanStack Query if no REST endpoints remain that need it (settings/info may still use it)

### [x] 3h. Update data models

- Rename `StateTask` → `Task`, fields come from SurrealDB records directly
- Timestamps are SurrealDB `datetime` (ISO strings) → parse to `Date` in `useLiveQuery` or a transform layer
- Remove `recentTaskIds` / `recentTasksCapacity` concepts (handled by query ordering + limit)
- Worker model includes all inspect data as optional fields (schemaless allows this)

**Files to create:** `frontend/app/components/surrealdb-provider.tsx`, `frontend/app/components/connection-status.tsx`, `frontend/app/components/login-dialog.tsx`, `frontend/app/hooks/use-live-query.ts`, `frontend/app/hooks/use-live-tasks.ts`, `frontend/app/hooks/use-live-workers.ts`, `frontend/app/hooks/use-live-events.ts`, `frontend/app/hooks/use-explorer-tasks.ts`, `frontend/app/hooks/use-search.ts`, `frontend/app/hooks/use-exceptions-summary.ts`
**Files to modify:** All route files, all components reading from state store, `__root.tsx`
**Files to remove:** `use-state-store.ts`, `use-state-store.test.ts`, `celery-state-sync.tsx`, `translate-server-models.ts`, `use-raw-events.ts`, `use-client.ts`, `use-task-state.ts`, `use-task-result.ts`, `use-online-worker-ids.ts`, `use-worker-stats.ts`, `use-worker-queues.ts`, `use-worker-active-tasks.ts`, `use-worker-scheduled-tasks.ts`, `use-worker-reserved-tasks.ts`, `use-worker-revoked-tasks.ts`, `use-worker-registered-tasks.ts`, `demo-client.ts`, `web-socket-utils.ts`

## [ ] Phase 4: Demo Mode

### [x] 4a. Embedded SurrealDB WASM (lazy-loaded)

- Use `surrealdb` JS SDK with `Surreal.connect("mem://")` for in-browser embedded mode
- **Lazy-load the WASM module** (5-10MB) only when demo mode is activated — do not include in the main bundle
  - Use dynamic `import()` in the `SurrealDBProvider` when demo is detected
  - Show the app shell immediately with a loading overlay: "Loading demo database..." with a progress indicator (not just a spinner — the download is large enough that users need feedback)
  - Cache the WASM module via service worker or Cache API so subsequent visits load instantly
- The `SurrealDBProvider` detects demo mode and connects to embedded instead of remote
- Run schema initialization in the browser (same DEFINE statements, minus auth since permissions are irrelevant locally)

### [x] 4b. Demo event generator (`frontend/app/components/demo-event-generator.ts`)

- Replace current `DemoSimulator` component and simulator utilities
- Generates fake Celery events (task-sent, task-received, task-started, task-succeeded, task-failed, worker-online, worker-heartbeat)
- Inserts them directly into the embedded SurrealDB using the same schema:
  - `CREATE event SET ...` for raw events
  - `UPDATE task:$id MERGE { ... }` for task aggregation (same logic as Python ingester)
  - `UPDATE worker:$id MERGE { ... }` for worker state
- Simulates realistic workflows (parent/child tasks, retries, different states)
- Rest of the app uses the same live query hooks — no special demo code paths

### [x] 4c. Remove old demo infrastructure

- Remove `DemoClient` (`frontend/app/services/demo/demo-client.ts`) and related abstraction layers
- Remove `useClient()` hook that switches between real/demo clients
- Remove simulator utilities: `frontend/app/utils/simulator/task-simulator.ts`, `worker-simulator.ts`, `exception-simulator.ts`, `cancellation-token.ts`
- Remove `demo-simulator.tsx` component
- The only branching point is in `SurrealDBProvider`: remote vs. embedded connection

**Files to create:** `frontend/app/components/demo-event-generator.ts`
**Files to modify:** `frontend/app/components/surrealdb-provider.tsx`, `__root.tsx`
**Files to remove:** `demo-simulator.tsx`, `demo-client.ts`, `frontend/app/utils/simulator/*`, `use-client.ts`

## [ ] Phase 5: Cleanup & Polish

### [x] 5a. Remove dead code

- Remove all Python REST endpoint files and their tests (tasks, workers, events, search routers)
- Remove WebSocket-related server code and tests
- Remove `server/pagination.py` (no more paginated REST responses)
- Remove unused Python models that were only used by REST endpoints
- Remove `server/workers/dependencies.py` (inspect dependency — now handled by poller)

### [x] 5b. Update documentation

- Update `CLAUDE.md`:
  - **Architecture section**: Bun is the orchestrator (owns settings, spawns SurrealDB + Python, runs leader election). Python is a pure ingester subprocess. Frontend talks directly to SurrealDB.
  - **Stack section**: Add SurrealDB. Update real-time description (live queries replace WebSocket). Note Bun's expanded role.
  - **Repo map**: Add `frontend/src/surreal-schema.ts`, `server/surrealdb_client.py`. Remove WS, search, pagination entries. Update bun-entry.ts description.
  - **Commands**: Remove `bun run generate-client` (or update if settings endpoints remain). Add `bun run dev:surreal`.
  - **Development section**: Three terminals now — SurrealDB, Python, Vite. Or document `dev:surreal` script.
  - **Deployment section**: Note SurrealDB is bundled in Docker. Document `SURREALDB_STORAGE` for persistent mode.
- Update `CONFIGURATION.md`:
  - Add all new env vars: SurrealDB connection, ingestion control (enabled, leader election, lock TTL/heartbeat), data retention, batch interval
  - Update MAX_TASKS/MAX_WORKERS → now `TASK_MAX_COUNT` and handled by cleanup job, not in-memory LRU
  - Document read-only mode (`INGESTION_ENABLED=false`)
  - Document multi-instance setup (leader election)
  - Document external SurrealDB (`SURREALDB_EXTERNAL_URL`)
  - Document storage modes (memory, rocksdb, surrealkv)
- Update `CONTRIBUTING.md`:
  - Add SurrealDB to prerequisites
  - Add `bun run dev:surreal` to dev setup instructions
  - Update "Run dev server" to three processes
  - Note that settings are Bun-owned, Python receives via env vars

### [x] 5c. Update dependencies

- Add `surrealdb` to `pyproject.toml`
- Add `surrealdb` to frontend `package.json` (via `bun add surrealdb`)
- Remove from frontend `package.json`: `lru-cache`, `react-use-websocket`
- Remove or keep `openapi-typescript-codegen` (depends on whether remaining settings endpoints justify it)
- Remove `@tanstack/react-query` if no REST endpoints remain that use it (evaluate — settings/info endpoint may still benefit from it)

### [x] 5d. Update tests

- **Backend (Python)**: Remove tests for deleted routers/models. Add tests for:
  - `SurrealDBIngester` — event batching, task upsert, worker upsert, children array handling
  - `ResultFetcher` — terminal state detection, result backend fetch, SurrealDB update
  - `WorkerPoller` — inspect API calls, offline detection, SurrealDB upserts
  - `CleanupJob` — count-based pruning, time-based pruning, cascading event deletion, dead worker cleanup
- **Bun orchestrator** (`frontend/bun-entry.ts` or extracted modules): Add tests for:
  - Schema migration — idempotent, viewer record seeding, ingestion_lock table creation
  - Leader election — lock acquisition, heartbeat refresh, stale lock takeover, graceful release, standby→leader promotion
  - Subprocess management — Python spawned only when leader, env var forwarding, restart on crash
  - Read-only mode — Python not spawned when `INGESTION_ENABLED=false`
- **Frontend**: Remove tests for deleted stores/hooks. Add tests for:
  - `useLiveQuery` — initial fetch, live notification handling (CREATE/UPDATE/DELETE), ordering, limiting, cleanup
  - `SurrealDBProvider` — production connection, demo WASM connection, reconnection
  - Component tests — update to use new hooks instead of state store
  - Search hook — debounce, query execution

### [ ] 5e. Regenerate OpenAPI client

- If any REST endpoints remain (settings), regenerate the OpenAPI client: `cd frontend && bun run generate-client`
- If all data access is via SurrealDB and only `/health` + settings endpoints remain, evaluate whether the generated client is still needed

## [ ] Phase 6: Future Enhancements (post-migration)

These features become possible with persistent storage but are out of scope for the initial migration:

### [ ] 6a. Historical analytics

- **Task throughput chart**: `SELECT count(), time::group('minute', last_updated) FROM task GROUP BY time::group('minute', last_updated)` — tasks/minute over time
- **Failure rate trends**: success/failure ratio over configurable time periods
- **Task duration histograms**: aggregate runtime by task type
- **Worker load comparison**: tasks processed per worker over time

### [ ] 6b. Data export

- Export filtered task data as CSV/JSON from the Explorer page
- Full database backup/restore via SurrealDB's native export/import

### [ ] 6c. Retention policy UI

- Settings panel where users can view/modify retention policies without restarting
- Show database size and record counts
- Manual cleanup trigger button

### [ ] 6d. Task comparison

- Side-by-side comparison of two executions of the same task type
- Show differences in args, duration, result, exception

## Dependencies

**Python:** `surrealdb>=1.0.8` (add to `pyproject.toml`)
**Frontend/Bun:** `surrealdb` npm package (add via `bun add surrealdb`), `zod` (add via `bun add zod`), `concurrently` (add via `bun add -d concurrently`)
**Infrastructure:** SurrealDB binary (pinned v2.x minor, e.g., `v2.1.4`) — installed in Docker image, developers install locally

## Verification

1. [ ] **Infrastructure**: Start app with `bun run bun-entry.ts` → Zod validates env vars → SurrealDB subprocess starts → schema migration runs → leader election → Python spawned → ingestion starts. Start with invalid env (e.g., `PORT=abc`) → fails fast with clear Zod error
2. [ ] **Auth (anonymous)**: Start without `SURREALDB_FRONTEND_PASS` → frontend connects immediately, no login dialog, can SELECT but cannot CREATE/UPDATE/DELETE
3. [ ] **Auth (password)**: Set `SURREALDB_FRONTEND_PASS=secret` → frontend shows login dialog → enter wrong password → inline error → enter correct password → dashboard loads. Refresh page → session token in `sessionStorage` → reconnects without dialog. Close tab → reopen → dialog shows again.
4. [ ] **Config endpoint**: `GET /api/config` returns `{ authRequired, surrealPath, ingestionStatus }` — verify values match env config
5. [ ] **Ingestion**: Generate Celery tasks → verify records appear in SurrealDB via `surreal sql` CLI → verify batching (events accumulate, flush every 100ms, terminal events flush immediately)
6. [ ] **Out-of-order events**: Send task-succeeded before task-started → verify state is not regressed, both timestamps are correctly set
7. [ ] **Event backpressure**: Stop SurrealDB while events flow → verify queue caps at 10k with logged warnings → restart SurrealDB → ingestion resumes
8. [ ] **Live queries**: Open browser → homepage shows live-updating recent tasks, new tasks appear without page refresh
9. [ ] **Reconnection recovery**: Kill SurrealDB briefly → UI shows "Disconnected" → restart → live queries re-subscribe, initial query re-runs, toast shows "Connection restored"
10. [ ] **Worker page**: Worker details (stats, active tasks, queues) populate from periodic polling, offline workers marked after 3 consecutive missed polls
11. [ ] **Task detail**: Click task → see full detail including result/exception (verify large results are truncated with flag), see raw events timeline
12. [ ] **Workflow**: Navigate to workflow view → all related tasks render in graph (including children array correctly maintained)
13. [ ] **Explorer**: Faceted filtering pushes WHERE clauses to SurrealDB → paginated results → live-refreshing on new events (debounced)
14. [ ] **Search**: Search bar queries SurrealDB directly → returns matching tasks (by id, type, exception) and workers
15. [ ] **Demo mode**: Enable demo → WASM lazy-loads with progress indicator → embedded SurrealDB spins up → fake events flow → app works identically to production. Second visit loads WASM from cache instantly.
16. [ ] **Cleanup**: Set low `task_max_count` → verify old tasks and their events get pruned automatically
17. [ ] **External SurrealDB**: Set `SURREALDB_EXTERNAL_URL` → app connects to external instance, no subprocess spawned
18. [ ] **Settings endpoints**: `/api/settings/info` returns correct task/worker counts from SurrealDB. `POST /api/settings/clear` truncates all tables. Debug bundle includes SurrealDB state dump.
19. [ ] **Read-only instance**: Set `INGESTION_ENABLED=false` → no Python spawned → frontend shows "Read-only mode" banner → frontend works normally (reads existing data)
20. [ ] **Ingestion status indicator**: Verify UI shows correct status: "Ingesting" (leader), "Standby" (standby), "Read-only" (disabled)
21. [ ] **Leader election**: Start two instances pointing at the same SurrealDB → only one acquires lock (atomic UPDATE) and ingests. Kill the leader → standby detects stale lock within `ttl_seconds`, promotes itself, starts ingesting. Verify no duplicate writes during transition.
22. [ ] **Leader graceful shutdown**: Stop the leader cleanly → lock is released immediately → standby takes over without waiting for TTL
23. [ ] **Docker**: `docker build .` succeeds, container starts with SurrealDB included (pinned version)
24. [ ] **Tests**: `uv run pytest` and `bun run test` pass
