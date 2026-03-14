# Configuration

Celery Insights is configured through environment variables passed to the container entrypoint. The settings panel inside the app covers UI preferences and some local behavior, but the variables below control Celery connectivity, storage, ingestion, cleanup, and logs.

Use environment variables for standard deployments. Mount a Celery config file only when broker and result-backend URLs are no longer enough.

> If Celery Insights needs to reach a service running on your machine from inside Docker, use `host.docker.internal` rather than `localhost`.

## Start Here

If you only need the minimum set of values, start with one of these combinations and then use the reference below for the details:

- Local or disposable run: set `BROKER_URL` and `RESULT_BACKEND`, then leave the embedded SurrealDB on its default `memory` storage.
- Durable single node: add `SURREALDB_STORAGE=rocksdb:///data/surreal` and mount `/data`.
- HA or Kubernetes: use `SURREALDB_EXTERNAL_URL`, keep `INGESTION_LEADER_ELECTION=true`, and set both `SURREALDB_INGESTER_PASS` and `SURREALDB_FRONTEND_PASS`.

## Quick Reference

### Most common

[`BROKER_URL`](#broker_url) · [`RESULT_BACKEND`](#result_backend) · [`SURREALDB_STORAGE`](#surrealdb_storage) · [`SURREALDB_EXTERNAL_URL`](#surrealdb_external_url)

### Scale and HA

[`INGESTION_ENABLED`](#ingestion_enabled) · [`INGESTION_LEADER_ELECTION`](#ingestion_leader_election) · [`INGESTION_LOCK_TTL_SECONDS`](#ingestion_lock_ttl_seconds) · [`INGESTION_LOCK_HEARTBEAT_SECONDS`](#ingestion_lock_heartbeat_seconds)

### Security

[`SURREALDB_INGESTER_PASS`](#surrealdb_ingester_pass) · [`SURREALDB_FRONTEND_PASS`](#surrealdb_frontend_pass) · [`LOG_FORMAT`](#log_format)

## Celery Connection

#### BROKER_URL

Default: `amqp://guest:guest@host.docker.internal/`

Broker URL for the Celery cluster you want to observe.

[Celery broker documentation](https://docs.celeryq.dev/en/stable/userguide/configuration.html#broker-url)

#### RESULT_BACKEND

Default: `redis://host.docker.internal:6379/0`

Result backend used to enrich task state transitions, result metadata, and task detail pages.

[Celery result backend documentation](https://docs.celeryq.dev/en/stable/userguide/configuration.html#result-backend)

#### CONFIG_FILE

Default: `/app/config.py`

Optional Celery config module mounted into the container. When the file exists at startup, it takes precedence over `BROKER_URL` and `RESULT_BACKEND`.

Use this for Sentinel, transport options, TLS settings, serializer configuration, or any other Celery options that do not fit cleanly into one URL.

#### TIMEZONE

Default: `UTC`

Set this to the same timezone used by your Celery cluster. Celery Insights converts timestamps for the browser, but the source timezone still needs to be consistent so task timelines line up correctly.

## Runtime and Logs

#### PORT

Default: `8555`

Public HTTP port served by Bun. This is the port you expose from Docker, Compose, or Kubernetes.

#### DEBUG

Default: `false`

Enables developer-oriented behavior such as hot reload, verbose error output, and additional event logging. Leave it disabled in production.

#### LOG_FORMAT

Default: `pretty`

Controls log output format for both Bun and Python.

- `pretty` for human-readable logs with timestamps, colors, and service prefixes
- `json` for structured logging pipelines and log aggregation systems

#### LOG_LEVEL

Default: `info`

Minimum log level shared by Bun and Python. Supported values are `debug`, `info`, `warn`, and `error`.

## SurrealDB

Celery Insights stores task, worker, and event history in SurrealDB. It can either start an embedded SurrealDB subprocess or connect to an external shared instance.

#### SURREALDB_URL

Default: `ws://localhost:8557/rpc`

Internal WebSocket URL used by Celery Insights to talk to SurrealDB. Most deployments should leave this alone.

If `SURREALDB_EXTERNAL_URL` is set and `SURREALDB_URL` is still at its default value, Celery Insights automatically switches internal connections to the external URL.

#### SURREALDB_EXTERNAL_URL

Default: _(not set)_

When set, Celery Insights skips the embedded SurrealDB subprocess and connects to this shared external endpoint instead.

Use this for high availability, Kubernetes, multi-replica deployments, or any setup where several Celery Insights instances should share one history store.

#### SURREALDB_PORT

Default: `8557`

Port used by the embedded SurrealDB subprocess. Ignored when `SURREALDB_EXTERNAL_URL` is set.

#### SURREALDB_STORAGE

Default: `memory`

Storage engine for the embedded SurrealDB subprocess.

- `memory` keeps all data in memory and loses it on restart
- `rocksdb:///data/surreal` stores data on local disk with RocksDB
- `surrealkv:///data/surreal` stores data on local disk with SurrealKV

Inside the container, `/data` is the intended persistent volume mount point.

#### SURREALDB_NAMESPACE

Default: `celery_insights`

SurrealDB namespace used for the application schema. Change this when you need tenant or environment isolation in a shared SurrealDB instance.

#### SURREALDB_DATABASE

Default: `main`

Database name inside the configured SurrealDB namespace.

#### SURREALDB_INGESTER_PASS

Default: `changeme`

Password for the `ingester` database user. The Python ingester uses this credential to write task, worker, and event data.

Change this in every non-local deployment.

#### SURREALDB_FRONTEND_PASS

Default: _(not set)_

Optional dashboard password. When set, the frontend requires login and authenticates as a read-only database user. When unset, the dashboard connects anonymously with read-only access.

## Debug Bundles and Snapshot Replay

Operators usually create the bundle from **Settings** -> **Download diagnostics**. The generated `debug bundle v2` captures effective config, runtime diagnostics, recent Bun/Python/SurrealDB logs, and a full SurrealDB export of `task`, `event`, and `worker`.

Secrets are redacted by default. Leave them redacted for bug reports unless someone investigating the issue explicitly needs the exact credentials.

#### DEBUG_BUNDLE_PATH

Default: _(not set)_

Absolute path to a `debug bundle v2` zip file mounted into the container at startup.

When set, Celery Insights boots into an offline, read-only replay of that captured system:

- live Celery ingestion is disabled
- leader election is disabled
- external SurrealDB is ignored in favor of the embedded database
- the bundled `task`, `event`, and `worker` export is restored transactionally before traffic is served

`SURREALDB_STORAGE` still applies in replay mode. Leave it unset for in-memory replay, or point it at a local embedded path if you want the replay database to persist across container restarts.

Inside this repository, `just start-debug /absolute/path/to/debug-bundle-v2.zip` starts the test compose stack with the bundle mounted into the `celery-insights` service.

Example: disposable in-memory replay

```bash
docker run --rm -p 8555:8555 \
  -v "$PWD/debug-bundle-v2.zip:/snapshot/debug-bundle-v2.zip:ro" \
  -e DEBUG_BUNDLE_PATH=/snapshot/debug-bundle-v2.zip \
  ghcr.io/danyi1212/celery-insights:latest
```

Example: replay with a persistent local SurrealDB volume

```bash
docker run --rm -p 8555:8555 \
  -v "$PWD/debug-bundle-v2.zip:/snapshot/debug-bundle-v2.zip:ro" \
  -v celery-insights-replay:/data \
  -e DEBUG_BUNDLE_PATH=/snapshot/debug-bundle-v2.zip \
  -e SURREALDB_STORAGE=rocksdb:///data/replay \
  ghcr.io/danyi1212/celery-insights:latest
```

## Ingestion and High Availability

Leader election allows multiple Celery Insights instances to share one SurrealDB without duplicating event ingestion.

#### INGESTION_ENABLED

Default: `true`

When `false`, this instance never starts the Python ingester and can never become the active ingestion leader.

Use this only for specialized viewer-only pods. It is not the normal multi-replica pattern.

#### INGESTION_LEADER_ELECTION

Default: `true`

When enabled, several Celery Insights instances can point at the same SurrealDB and only one of them will actively ingest events at a time.

Disable this only for simple single-instance deployments or intentionally duplicated ingestion setups.

#### INGESTION_LOCK_TTL_SECONDS

Default: `30`

How long the leader lease remains valid after missed heartbeats. If the active ingester crashes, another instance can take over after this interval expires.

#### INGESTION_LOCK_HEARTBEAT_SECONDS

Default: `10`

How often the active ingester renews its leader lease. This value must stay lower than `INGESTION_LOCK_TTL_SECONDS`.

#### INGESTION_BATCH_INTERVAL_MS

Default: `100`

How often non-terminal Celery events are flushed to SurrealDB, in milliseconds. Lower values produce fresher data with more writes. Terminal events are flushed immediately regardless of this interval.

## Retention and Cleanup

Retention policies are enforced by the Python cleanup job rather than native SurrealDB TTL behavior.

#### TASK_MAX_COUNT

Default: _(not set)_

Optional cap on the number of tasks retained in SurrealDB. When set, the oldest tasks and their associated events are pruned once the limit is exceeded.

Leave it unset to disable count-based pruning.

#### TASK_RETENTION_HOURS

Default: _(not set)_

Optional age-based retention window for tasks. Tasks older than this many hours are pruned.

This can be used together with `TASK_MAX_COUNT`.

#### DEAD_WORKER_RETENTION_HOURS

Default: `24`

How long offline worker records remain in SurrealDB before cleanup removes them.

#### CLEANUP_INTERVAL_SECONDS

Default: `60`

How often the cleanup job evaluates and applies retention policies.

## Setup with a Config File

Use a Celery config file when broker and result-backend URLs are not enough for your cluster topology.

Typical reasons to use `CONFIG_FILE`:

- Redis Sentinel
- Transport or backend options
- TLS settings
- Non-default serializers
- Optional Celery extras such as msgpack or additional backend drivers

Example `config.py`:

```python
broker_url = "sentinel://localhost:26379;sentinel://localhost:26380;sentinel://localhost:26381"
broker_transport_options = {
    "sentinel_kwargs": {
        "master_name": "cluster1",
        "password": "password",
    },
}
result_backend_transport_options = {"master_name": "cluster1"}
result_accept_content = ["json", "msgpack"]
task_serializer = "msgpack"
result_serializer = "msgpack"
```

Mount it into the container:

```shell
docker run -v ./config.py:/app/config.py -p 8555:8555 --name celery-insights ghcr.io/danyi1212/celery-insights:latest
```

If the cluster needs optional Celery extras, use `ghcr.io/danyi1212/celery-insights-all:latest`.

## Multi-Instance Setup

For high availability or scaled deployments, point multiple Celery Insights instances at the same SurrealDB:

1. Set up a shared external SurrealDB instance.
2. Configure every Celery Insights instance with the same `SURREALDB_EXTERNAL_URL`.
3. Leave `INGESTION_LEADER_ELECTION=true` so only one instance ingests events at a time.
4. If the active ingester goes down, another instance takes over after `INGESTION_LOCK_TTL_SECONDS`.

Only set `INGESTION_ENABLED=false` when you explicitly need viewer-only pods that must never participate in leader election.

## Prometheus Metrics

Celery Insights exposes Prometheus and OpenMetrics endpoints for external monitoring systems such as Prometheus, Grafana, and Datadog.

### Endpoints

#### `GET /metrics` - Core Celery metrics

Low-cardinality metrics for cluster-level dashboards.

| Metric | Type | Labels |
| --- | --- | --- |
| `celery_tasks_total` | Gauge | - |
| `celery_tasks_by_state` | Gauge | `state` |
| `celery_workers_total` | Gauge | - |
| `celery_workers_online` | Gauge | - |
| `celery_workers_offline` | Gauge | - |
| `celery_task_runtime_seconds` | Histogram | - |
| `celery_tasks_succeeded_total` | Gauge | - |
| `celery_tasks_failed_total` | Gauge | - |
| `celery_tasks_retried_total` | Gauge | - |

#### `GET /metrics/verbose` - Detailed metrics

Higher-cardinality metrics for deeper task and worker breakdowns. Includes everything from `/metrics`.

| Metric | Type | Labels |
| --- | --- | --- |
| _(all core metrics above)_ |  |  |
| `celery_tasks_by_type` | Gauge | `task_type` |
| `celery_tasks_by_worker` | Gauge | `worker` |
| `celery_task_runtime_seconds_by_type` | Histogram | `task_type` |
| `celery_exceptions_by_type` | Gauge | `exception` |
| `celery_worker_active_tasks` | Gauge | `worker` |
| `celery_worker_processed_tasks` | Gauge | `worker` |

#### `GET /metrics/system` - Celery Insights internal metrics

Operational metrics for the Celery Insights process itself.

| Metric | Type | Labels |
| --- | --- | --- |
| `celery_insights_uptime_seconds` | Gauge | - |
| `celery_insights_cpu_load` | Gauge | `interval` (1m, 5m, 15m) |
| `celery_insights_memory_rss_bytes` | Gauge | - |
| `celery_insights_events_ingested_total` | Gauge | - |
| `celery_insights_events_dropped_total` | Gauge | - |
| `celery_insights_flushes_total` | Gauge | - |
| `celery_insights_buffer_size` | Gauge | - |
| `celery_insights_queue_size` | Gauge | - |
| `celery_insights_db_tasks_count` | Gauge | - |
| `celery_insights_db_workers_count` | Gauge | - |
| `celery_insights_db_events_count` | Gauge | - |

### Example Prometheus scrape config

```yaml
scrape_configs:
  - job_name: "celery-insights"
    scrape_interval: 15s
    metrics_path: /metrics
    static_configs:
      - targets: ["localhost:8555"]

  - job_name: "celery-insights-verbose"
    scrape_interval: 60s
    metrics_path: /metrics/verbose
    static_configs:
      - targets: ["localhost:8555"]

  - job_name: "celery-insights-system"
    scrape_interval: 30s
    metrics_path: /metrics/system
    static_configs:
      - targets: ["localhost:8555"]
```

## Built-in Reverse Proxy

Bun is the public entrypoint and built-in reverse proxy:

- `/surreal/*` is proxied to SurrealDB, including WebSocket traffic
- `/api/*` and `/metrics` are proxied to the Python ingester
- all other routes serve the SPA

The built-in proxy is HTTP-only. Terminate TLS in your ingress, load balancer, or edge proxy.

## Support Matrix

Legend:

- `fully supported` means the setup is expected to work with the standard image
- `supported with celery-insights-all` means optional Celery extras are required
- `limited features` means basic connectivity works but some monitoring features are incomplete
- `not supported` means the current app does not support that setup

### Serializers

| Feature | Status |
| --- | --- |
| auth | supported with `celery-insights-all` |
| msgpack | supported with `celery-insights-all` |
| yaml | supported with `celery-insights-all` |

### Brokers

| Feature | Status |
| --- | --- |
| RabbitMQ | fully supported |
| Redis | fully supported |
| Amazon SQS | not supported |
| ZooKeeper | supported with `celery-insights-all` |

### Result backends

| Feature | Status |
| --- | --- |
| Redis | fully supported |
| RPC | limited features |
| Memcache | supported with `celery-insights-all` |
| SQLAlchemy | supported with `celery-insights-all` |
| MongoDB | supported with `celery-insights-all` |
| Cassandra | not supported |
| IronCache | not supported |
| S3 | supported with `celery-insights-all` |
| Azure Block Blob | supported with `celery-insights-all` |
| Elasticsearch | supported with `celery-insights-all` |
| AWS DynamoDB | supported with `celery-insights-all` |
| Couchbase | not supported |
| CouchDB | supported with `celery-insights-all` |
| ArangoDB | supported with `celery-insights-all` |
| Cosmos DB | supported with `celery-insights-all` |
| File system | limited features |
| Consul | supported with `celery-insights-all` |
| Riak | supported with `celery-insights-all` |
| Django ORM | not supported |

Feel free to open a feature request if your Celery deployment is missing from this list.
