# Configuration

Celery Insights can be configured using environment variables.
Additional preferences can be found on the Settings page within the app.

By default, Celery Insights uses only Broker URL and Result Backend to connect to your Celery Cluster.

In case you have set up a [Config File](#setup-with-config-file),
Celery Insights will prefer it over the `BROKER_URL` and `RESULT_BACKEND` environment variables.

If your setup requires
[extra Celery dependencies](https://docs.celeryq.dev/en/main/getting-started/introduction.html#bundles)
(e.g. msgpack, sqs, etc.), you may use the `celery-insights-all` Docker image instead.

> :exclamation: Tip
>
> If you want Celery Insights to access a local service, like a Redis container, use `host.docker.internal` instead
of `localhost`.
> [See more on Docker docs](https://docs.docker.com/desktop/networking/#use-cases-and-workarounds-for-all-platforms)

## Server

### PORT

Default: `8555`

Specify the port Bun serves on externally.
In production, the Python ingester runs on an internal port (8556) managed by Bun automatically.

### HOST

Default: `0.0.0.0`

Specify the Python backend hostname. By default, it will listen to all IP addresses.

### TIMEZONE

Default: `UTC`

Specify the time zone for your cluster.
For correct timestamps, it should be the same as your Celery nodes.
All timestamps shown on the app are translated to the client's local timezone.

### DEBUG

Default: `false`

Enables Celery Insights to run in debug mode, that includes hot-reload, response tracebacks and Celery event logs.

## Celery Connection

### BROKER_URL

Default: `amqp://guest:guest@host.docker.internal/`

Specify the Celery Broker URL.
[See more on Celery docs.](https://docs.celeryq.dev/en/stable/userguide/configuration.html#broker-url)

### RESULT_BACKEND

Default: `redis://host.docker.internal:6379/0`

Specify the Celery Result Backend.
[See more on Celery docs.](https://docs.celeryq.dev/en/stable/userguide/configuration.html#result-backend)

### CONFIG_FILE

Default: `/app/config.py`

Specify the path where the Config File should be located for Celery Insights.
For instructions on how to set it up, refer to the [Setup with Config File](#setup-with-config-file) section.

## SurrealDB

Celery Insights uses SurrealDB as its data store. By default, an embedded SurrealDB subprocess is started automatically.

### SURREALDB_URL

Default: `ws://localhost:8557/rpc`

Internal WebSocket URL for the SurrealDB instance. Only change this if you need a non-default internal port.

### SURREALDB_EXTERNAL_URL

Default: _(not set)_

When set, Celery Insights connects to an external SurrealDB instance instead of spawning its own subprocess. Use this for scaled deployments where multiple Celery Insights instances share a single SurrealDB.

Example: `SURREALDB_EXTERNAL_URL=ws://surrealdb.internal:8000/rpc`

### SURREALDB_PORT

Default: `8557`

Port for the embedded SurrealDB subprocess. Ignored when `SURREALDB_EXTERNAL_URL` is set.

### SURREALDB_STORAGE

Default: `memory`

Storage engine for the embedded SurrealDB subprocess. Options:
- `memory` — in-memory, data lost on restart (fastest, good for development)
- `rocksdb://path` — persistent storage using RocksDB
- `surrealkv://path` — persistent storage using SurrealKV

In Docker, the `/data` volume is available for persistent storage (e.g., `SURREALDB_STORAGE=rocksdb:///data/surreal`).

### SURREALDB_INGESTER_PASS

Default: `changeme`

Password for the `ingester` database user. The Python ingester authenticates with this credential to write data. Change this in production.

### SURREALDB_FRONTEND_PASS

Default: _(not set)_

When set, enables password protection for the frontend. Users must enter this password to access the dashboard. The frontend authenticates as a read-only `frontend` database user. When not set, the frontend connects anonymously with read-only access (no login dialog).

### SURREALDB_NAMESPACE

Default: `celery_insights`

SurrealDB namespace. Only change for multi-tenant setups.

### SURREALDB_DATABASE

Default: `main`

SurrealDB database name within the namespace.

## Ingestion Control

### INGESTION_ENABLED

Default: `true`

When `false`, no Python ingester is spawned. The app runs in read-only mode, displaying existing data from SurrealDB but not receiving new events. The UI shows a "Read-only mode" banner.

### INGESTION_LEADER_ELECTION

Default: `true`

When `true`, multiple Celery Insights instances can point at the same SurrealDB, and only one will actively ingest events. Uses an atomic SurrealDB lock for leader election. When `false`, every instance with `INGESTION_ENABLED=true` will ingest (suitable for single-instance deployments).

### INGESTION_LOCK_TTL_SECONDS

Default: `30`

How long a leader's lock is valid before it's considered stale. If the leader crashes without releasing the lock, a standby instance will take over after this duration.

### INGESTION_LOCK_HEARTBEAT_SECONDS

Default: `10`

How often the leader renews its lock. Must be less than `INGESTION_LOCK_TTL_SECONDS`.

## Data Retention

### TASK_MAX_COUNT

Default: `10000`

Maximum number of tasks to keep in SurrealDB. When exceeded, the oldest tasks (and their associated events) are pruned by the cleanup job. Set to empty to disable count-based pruning.

### TASK_RETENTION_HOURS

Default: _(not set)_

When set, tasks older than this many hours are pruned. Can be used together with `TASK_MAX_COUNT`.

### DEAD_WORKER_RETENTION_HOURS

Default: `24`

Workers that have been offline for this many hours are removed from SurrealDB.

### CLEANUP_INTERVAL_SECONDS

Default: `60`

How often the cleanup job runs to enforce retention policies.

## Ingestion Performance

### INGESTION_BATCH_INTERVAL_MS

Default: `100`

How often batched events are flushed to SurrealDB (in milliseconds). Lower values give faster updates but higher write frequency. Terminal events (task-succeeded, task-failed, etc.) are always flushed immediately regardless of this interval.

# Setup with Config File

In certain situations, connecting to your Celery cluster may require more than simply specifying the Broker URL and
Result Backend.
For such cases, you can configure Celery Insights
using a [Celery configuration file](https://docs.celeryq.dev/en/stable/userguide/configuration.html).

Create a `config.py` file containing all the necessary Celery configurations. For example:

```python
broker_url = 'sentinel://localhost:26379;sentinel://localhost:26380;sentinel://localhost:26381'
broker_transport_options = {
    'sentinel_kwargs': {
        'master_name': "cluster1",
        'password': "password",
    },
}
result_backend_transport_options = {'master_name': "cluster1"}
result_accept_content = "msgpack"
```

Then mount it inside Celery Insights container, for example:

```shell
docker run -v ./config.py:/app/config.py -p 8555:8555 --name celery-insights ghcr.io/danyi1212/celery-insights:latest
```

# Multi-Instance Setup

For high availability or scaled deployments, run multiple Celery Insights instances pointing at the same SurrealDB:

1. Set up an external SurrealDB instance (or use one Celery Insights instance's embedded SurrealDB)
2. Configure all instances with `SURREALDB_EXTERNAL_URL` pointing to the shared SurrealDB
3. Leave `INGESTION_LEADER_ELECTION=true` (default) — only one instance will ingest at a time
4. If the leader goes down, a standby instance automatically takes over within `INGESTION_LOCK_TTL_SECONDS`

For read-only dashboards (e.g., wall displays), set `INGESTION_ENABLED=false` to skip ingestion entirely.

## Support chart

:white_check_mark: - Fully Supported
:heavy_check_mark: - Supported with `celery-insights-all`
:ballot_box_with_check: - Limited features
:x: - Not supported

### Serializers

* :heavy_check_mark: auth
* :heavy_check_mark: msgpack
* :heavy_check_mark: yaml

### Brokers

* :white_check_mark: RabbitMQ
* :white_check_mark: Redis
* :x: Amazon SQS
* :heavy_check_mark: Zookeeper

### Result Backends

* :white_check_mark: Redis
* :ballot_box_with_check: RPC
* :heavy_check_mark: Memcache
* :heavy_check_mark: SQLAlchemy
* :heavy_check_mark: MongoDB
* :x: Casandra
* :x: IronCache
* :heavy_check_mark: S3
* :heavy_check_mark: Azure Block Blob
* :heavy_check_mark: ElasticSearch
* :heavy_check_mark: AWS DynamoDB
* :x: Couchbase
* :heavy_check_mark: CouchDB
* :heavy_check_mark: ArangoDB
* :heavy_check_mark: CosmoDB
* :ballot_box_with_check: File-System
* :heavy_check_mark: Consul
* :heavy_check_mark: Riak
* :x: Django ORM

Feel free to [submit a feature request](CONTRIBUTING.md) to support more setups.
