# Celery Insights Documentation

Configure Celery Insights, choose a deployment topology, and connect it to real Celery clusters.

## Quick Start

Follow this order for a new deployment:

1. Choose a deployment pattern.
   Decide first whether you are running with memory, local disk, or external SurrealDB.
2. Set the core connection variables.
   Most installs only need broker, result backend, and a few SurrealDB settings.
3. Match the app to your Celery topology.
   Use environment variables for simple clusters and a mounted config file for Sentinel or custom transports.
4. Apply production guardrails.
   Lock down credentials, wire health checks, and understand how leader election affects scaling.

Notes:

- The docs are bundled into the app, so operators can use them from a live deployment.
- External SurrealDB is the preferred path for HA, Kubernetes, and multi-replica deployments.
- Use a mounted Celery config file only when broker and result env vars are no longer enough.

## Configuration

These are the runtime inputs supported by the shipped container entrypoint. The settings panel inside the app covers UI preferences and retention tuning, while the values below control cluster connectivity, storage, ingestion, and logs.

### Summary

#### Most common

These are the settings most operators touch first.

- `BROKER_URL`
- `RESULT_BACKEND`
- `SURREALDB_STORAGE`
- `SURREALDB_EXTERNAL_URL`

#### Scale and HA

These control how multi-replica deployments behave.

- `INGESTION_ENABLED`
- `INGESTION_LEADER_ELECTION`
- `INGESTION_LOCK_TTL_SECONDS`

#### Security

Change these before exposing the app to other users.

- `SURREALDB_INGESTER_PASS`
- `SURREALDB_FRONTEND_PASS`
- `LOG_FORMAT=json`

### Celery connection

The Bun entrypoint reads these values and forwards the Celery-related subset to the Python ingester automatically.

| Variable | Default | Notes |
| --- | --- | --- |
| `BROKER_URL` | `amqp://guest:guest@host.docker.internal/` | Broker URL for the cluster you want to observe. |
| `RESULT_BACKEND` | `redis://host.docker.internal:6379/0` | Result backend used to enrich terminal task states and metadata. |
| `CONFIG_FILE` | `/app/config.py` | Optional Celery config module mounted into the container. When present, it takes precedence over `BROKER_URL` and `RESULT_BACKEND`. |
| `TIMEZONE` | `UTC` | Should match the Celery cluster timezone so task timestamps line up correctly. |

### SurrealDB

These values control whether the app manages its own SurrealDB subprocess or connects to a shared one.

| Variable | Default | Notes |
| --- | --- | --- |
| `SURREALDB_STORAGE` | `memory` | Embedded storage engine. Use memory for ephemeral setups, or `rocksdb:///data/surreal` / `surrealkv:///data/surreal` for durable local storage. |
| `SURREALDB_EXTERNAL_URL` | `unset` | When set, the app skips the embedded SurrealDB subprocess and points all reads and writes at the shared external endpoint. |
| `SURREALDB_PORT` | `8557` | Embedded SurrealDB port. Ignored when `SURREALDB_EXTERNAL_URL` is set. |
| `SURREALDB_NAMESPACE` | `celery_insights` | Namespace used for the app schema. Useful for tenant or environment isolation. |
| `SURREALDB_DATABASE` | `main` | Database name inside the namespace. |
| `SURREALDB_INGESTER_PASS` | `changeme` | Password for the ingester database user. Change it in every production deployment. |
| `SURREALDB_FRONTEND_PASS` | `unset` | Optional dashboard password. When set, the frontend switches from anonymous viewer access to password-protected login. |

### Ingestion and HA

Leader election makes multi-replica deployments safe by ensuring only one ingester writes events at a time.

| Variable | Default | Notes |
| --- | --- | --- |
| `INGESTION_ENABLED` | `true` | Disable this only when a pod must never become the active ingester. This is an advanced scaling control, not the default replica pattern. |
| `INGESTION_LEADER_ELECTION` | `true` | Keeps one active ingester when multiple app replicas point at the same SurrealDB. Leave enabled for HA setups. |
| `INGESTION_LOCK_TTL_SECONDS` | `30` | How long a leader lease remains valid after missed heartbeats. |
| `INGESTION_LOCK_HEARTBEAT_SECONDS` | `10` | Heartbeat interval for the leader lease. Must stay lower than the TTL. |
| `INGESTION_BATCH_INTERVAL_MS` | `100` | Batch flush interval for non-terminal events. Lower values trade more writes for faster freshness. |

### Retention and cleanup

Retention is enforced by the Python cleanup job, not by native SurrealDB TTL features.

| Variable | Default | Notes |
| --- | --- | --- |
| `TASK_MAX_COUNT` | `unset` | Optional cap on the number of tasks retained. Leave unset to disable count-based pruning. |
| `TASK_RETENTION_HOURS` | `unset` | Optional age-based pruning window for tasks. |
| `DEAD_WORKER_RETENTION_HOURS` | `24` | How long offline worker records stay in the database. |
| `CLEANUP_INTERVAL_SECONDS` | `60` | How often the cleanup job enforces retention policies. |

### Runtime and logs

These values control the container entrypoint itself and the format of operational output.

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `8555` | Public HTTP port served by Bun. This is the port you expose from Docker or Kubernetes. |
| `DEBUG` | `false` | Enables reload-oriented developer behavior. Keep it disabled in production. |
| `LOG_FORMAT` | `pretty` | `pretty` for human-readable logs, `json` for aggregation pipelines and structured logging stacks. |
| `LOG_LEVEL` | `info` | Shared minimum log level for Bun and Python subprocesses. |

## Deployment Patterns

Pick the SurrealDB topology first. That choice determines whether the app behaves like a disposable single container, a durable single node, or a shared multi-replica service.

### Summary

| Pattern | Use when | Watch for |
| --- | --- | --- |
| [Single container with in-memory SurrealDB](#single-container-with-in-memory-surrealdb) | Local evaluation, smoke tests, disposable environments. | All history disappears on restart. Do not use this if operators expect durable task history. |
| [Single container with persistent local disk](#single-container-with-persistent-local-disk) | One-node production, homelab, VM deployments, or Docker Compose setups that need local durability. | The database lives with that single instance. Replacing the container is fine, but horizontal scaling will create divergent local databases. |
| [Multiple app replicas with external SurrealDB](#multiple-app-replicas-with-external-surrealdb) | High availability, Kubernetes, wallboards, and any topology where the dashboard should survive pod or node loss. | The current bootstrap flow only lets you configure the SurrealDB URL. Use an external endpoint you control and validate its root/bootstrap compatibility before adopting a managed service such as SurrealDB Cloud. |
| [Pods excluded from ingestion leadership](#pods-excluded-from-ingestion-leadership) | Niche scaling systems where some pods should serve the UI only and must be excluded from leadership entirely. | This is not the normal multi-replica pattern. Most deployments should keep ingestion enabled and rely on leader election instead. |

### Single container with in-memory SurrealDB

Fastest setup.

Use the embedded database in memory for demos, CI, preview environments, or short-lived operator sessions.

Best for:

- Local evaluation
- Smoke tests
- Disposable environments

Watch for:

- All history disappears on restart.
- Do not use this if operators expect durable task history.

Key env vars:

- `SURREALDB_STORAGE=memory`

Example:

```sh
docker run -p 8555:8555 --name celery-insights \
  -e BROKER_URL=amqp://user:pass@rabbitmq:5672// \
  -e RESULT_BACKEND=redis://redis:6379/0 \
  -e SURREALDB_STORAGE=memory \
  ghcr.io/danyi1212/celery-insights:latest
```

Notes:

- This is the default storage mode, so the explicit env var is mostly for clarity.
- If you scale beyond one replica, move to an external SurrealDB first so history stays shared.

### Single container with persistent local disk

Recommended for one durable node.

Keep the embedded SurrealDB, but bind `/data` and switch storage to a durable engine.

Best for:

- One-node production
- Homelab
- VM deployments
- Docker Compose setups that need local durability

Watch for:

- The database lives with that single instance.
- Replacing the container is fine, but horizontal scaling will create divergent local databases.

Key env vars:

- `SURREALDB_STORAGE=rocksdb:///data/surreal`
- `VOLUME /data`

Example:

```sh
docker run -p 8555:8555 --name celery-insights \
  -v celery-insights-data:/data \
  -e BROKER_URL=amqp://user:pass@rabbitmq:5672// \
  -e RESULT_BACKEND=redis://redis:6379/0 \
  -e SURREALDB_STORAGE=rocksdb:///data/surreal \
  ghcr.io/danyi1212/celery-insights:latest
```

Notes:

- `surrealkv:///data/surreal` is also supported if you prefer SurrealKV over RocksDB.
- Persist `/data` with a named Docker volume, host path, or attached disk.

### Multiple app replicas with external SurrealDB

Recommended for HA and Kubernetes.

Point every Celery Insights replica at the same SurrealDB instance and keep leader election enabled.

Best for:

- High availability
- Kubernetes
- Wallboards
- Any topology where the dashboard should survive pod or node loss

Watch for:

- The current bootstrap flow only lets you configure the SurrealDB URL.
- Use an external endpoint you control and validate its root/bootstrap compatibility before adopting a managed service such as SurrealDB Cloud.

Key env vars:

- `SURREALDB_EXTERNAL_URL=wss://surrealdb.example.com/rpc`
- `INGESTION_LEADER_ELECTION=true`

Example:

```sh
docker run -p 8555:8555 --name celery-insights \
  -e BROKER_URL=amqp://user:pass@rabbitmq:5672// \
  -e RESULT_BACKEND=redis://redis:6379/0 \
  -e SURREALDB_EXTERNAL_URL=wss://surrealdb.example.com/rpc \
  -e SURREALDB_INGESTER_PASS=replace-this \
  -e SURREALDB_FRONTEND_PASS=replace-this \
  -e INGESTION_LEADER_ELECTION=true \
  ghcr.io/danyi1212/celery-insights:latest
```

Notes:

- Run at least two replicas if you want failover for the ingester.
- Shared SurrealDB makes replicas interchangeable and keeps leader election meaningful across the whole deployment.

### Pods excluded from ingestion leadership

Advanced control.

Set `INGESTION_ENABLED=false` when a pod must never spawn the Python ingester or participate in leader election.

Best for:

- Niche scaling systems where some pods should serve the UI only and must be excluded from leadership entirely

Watch for:

- This is not the normal multi-replica pattern.
- Most deployments should keep ingestion enabled and rely on leader election instead.

Key env vars:

- `INGESTION_ENABLED=false`
- `SURREALDB_EXTERNAL_URL=wss://surrealdb.example.com/rpc`

Example:

```sh
docker run -p 8555:8555 --name celery-insights-ui-only \
  -e SURREALDB_EXTERNAL_URL=wss://surrealdb.example.com/rpc \
  -e INGESTION_ENABLED=false \
  ghcr.io/danyi1212/celery-insights:latest
```

Notes:

- These pods only read existing data from SurrealDB and can never take over ingestion if the leader disappears.
- Use this only when your scheduler or traffic model explicitly requires non-leader-capable pods.

## Kubernetes and HPA

For Kubernetes, treat Celery Insights as a stateless web service and move durability into shared infrastructure. Autoscaling only makes sense once task history is shared across replicas.

One key rule:

- Use external SurrealDB before you scale the app horizontally. That one decision removes most of the complexity around failover, HPA, and pod replacement.

### Preferred topology

- Use an external SurrealDB when running more than one pod.
- Keep `INGESTION_LEADER_ELECTION=true` so only one pod writes Celery events at a time.
- Back the Deployment with a ClusterIP Service and terminate TLS at the ingress or load balancer.

### When to use a PVC

- A PVC only makes sense for a single-replica Deployment using embedded RocksDB or SurrealKV.
- Do not combine HPA with embedded local storage unless each replica is intentionally isolated.
- For autoscaling or failover, move the database out of the pod and into shared infrastructure first.

### HPA expectations

- Scale replicas for availability and frontend throughput, not ingestion throughput.
- Leader election means one replica is the active ingester at any moment.
- If the active ingester dies, another replica takes over after the lease expires and renews.

### Deployment and Service example

Baseline manifest for two replicas behind a ClusterIP service.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: celery-insights
spec:
  replicas: 2
  selector:
    matchLabels:
      app: celery-insights
  template:
    metadata:
      labels:
        app: celery-insights
    spec:
      containers:
        - name: app
          image: ghcr.io/danyi1212/celery-insights:latest
          ports:
            - containerPort: 8555
          env:
            - name: BROKER_URL
              valueFrom:
                secretKeyRef:
                  name: celery-insights
                  key: broker-url
            - name: RESULT_BACKEND
              valueFrom:
                secretKeyRef:
                  name: celery-insights
                  key: result-backend
            - name: SURREALDB_EXTERNAL_URL
              valueFrom:
                secretKeyRef:
                  name: celery-insights
                  key: surrealdb-url
            - name: SURREALDB_INGESTER_PASS
              valueFrom:
                secretKeyRef:
                  name: celery-insights
                  key: surrealdb-ingester-pass
            - name: SURREALDB_FRONTEND_PASS
              valueFrom:
                secretKeyRef:
                  name: celery-insights
                  key: surrealdb-frontend-pass
            - name: INGESTION_LEADER_ELECTION
              value: "true"
            - name: LOG_FORMAT
              value: "json"
          readinessProbe:
            httpGet:
              path: /health
              port: 8555
          livenessProbe:
            httpGet:
              path: /health
              port: 8555
---
apiVersion: v1
kind: Service
metadata:
  name: celery-insights
spec:
  selector:
    app: celery-insights
  ports:
    - port: 80
      targetPort: 8555
```

### HPA example

Use this only with an external SurrealDB or advanced non-ingester viewer pods.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: celery-insights
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: celery-insights
  minReplicas: 2
  maxReplicas: 6
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

## Celery Cluster Setups

Celery Insights is intentionally simple when one broker and one result backend are enough, but it can also inherit a full Celery config module for more advanced clusters.

### Quick guidance

#### Fast path

Use env vars when the cluster has one broker URL and one result backend URL.

#### Advanced path

Mount a config file for Sentinel, transport options, TLS settings, or non-default serializers.

#### Isolation rule

Separate broker domains generally mean separate Celery Insights deployments.

### Baseline event settings

Every worker pool that should appear in the UI needs to emit Celery events.

- Enable task events on all workers, not just one queue or deployment.
- `task_track_started` and `result_extended` are optional but strongly recommended for richer task pages.
- Keep worker clocks and the `TIMEZONE` env aligned so timelines stay coherent.

```python
from celery import Celery

app = Celery("myapp")
app.conf.worker_send_task_events = True
app.conf.task_send_sent_event = True
app.conf.task_track_started = True
app.conf.result_extended = True
app.conf.enable_utc = True
```

### Standard RabbitMQ or Redis deployments

If the cluster exposes one broker URL and one result backend URL, env vars are usually enough.

- Point `BROKER_URL` and `RESULT_BACKEND` at the same logical cluster your workers use.
- Run Celery Insights on the same network plane as the broker and backend. Inside containers, do not use `localhost` for peer services.
- Use the regular image unless your serializer or transport requires optional Celery extras.

### Sentinel, custom serializers, and advanced transport options

Mount a config module when the broker/backend setup needs more than two URLs.

- `CONFIG_FILE` takes precedence when the file exists at container start.
- This is the right place for Sentinel, SSL settings, broker transport options, and custom serialization config.
- Switch to `ghcr.io/danyi1212/celery-insights-all` when the Celery stack needs optional extras such as msgpack or additional backend drivers.

```python
broker_url = "sentinel://redis-0:26379;sentinel://redis-1:26379;sentinel://redis-2:26379"
broker_transport_options = {
    "master_name": "mymaster",
    "sentinel_kwargs": {"password": "secret"},
}

result_backend = "redis://mymaster/0"
result_backend_transport_options = {
    "master_name": "mymaster",
    "sentinel_kwargs": {"password": "secret"},
}

result_accept_content = ["json", "msgpack"]
task_serializer = "msgpack"
result_serializer = "msgpack"
```

### Multiple queues and worker pools

One Celery Insights instance can observe multiple worker groups as long as they share the same broker domain.

- Workers show up through Celery inspect polling, so keep remote control enabled if you want worker panels and queue details.
- Queue-specific pools are fine as long as events and inspect responses flow back through the same Celery control plane.
- If you intentionally isolate worker groups behind separate brokers, treat them as separate clusters and deploy one Celery Insights instance per cluster.

### Multiple isolated Celery clusters

Celery Insights is scoped to one broker/result-backend pair at a time.

- Use one Celery Insights deployment per isolated production cluster, region, or tenant boundary.
- If the instances share one external SurrealDB, isolate them with different `SURREALDB_NAMESPACE` and/or `SURREALDB_DATABASE` values.
- This keeps metrics, workers, and task history separated without needing separate container images.

## Production Notes

These are the behaviors most likely to matter once the app is behind a real load balancer, scrape target, or SRE handoff.

### Production checklist

- Prefer external SurrealDB before introducing multiple replicas, HPA, or rolling updates.
- Keep the app and workers on a network path that can reach the broker and result backend directly.
- Enable Celery task events on every worker pool you want represented in the UI.
- Change the default ingester password and add a frontend password on shared or public networks.

### Health, metrics, and scrape targets

- Use `/health` for liveness and readiness checks.
- Prometheus scrape targets are `/metrics`, `/metrics/verbose`, and `/metrics/system` depending on the level of detail you want.
- Verbose metrics add label cardinality, so scrape them less frequently than the core endpoint.

### Reverse proxy and TLS

- Bun is the single entrypoint: it serves the SPA and proxies `/api`, `/metrics`, and `/surreal/*` internally.
- The built-in proxy is HTTP-only. Terminate TLS in your ingress, load balancer, or edge proxy.
- If you expose the app publicly, prefer the frontend password and keep internal SurrealDB endpoints private.

### Security defaults to override

- Change `SURREALDB_INGESTER_PASS` in every non-local deployment.
- Set `SURREALDB_FRONTEND_PASS` when the dashboard is not on a fully trusted network.
- Store `BROKER_URL`, `RESULT_BACKEND`, and any config-file secrets in your secret manager rather than baking them into images.

### Scaling semantics

- Extra replicas primarily improve availability and frontend capacity.
- Leader election prevents duplicate ingestion, so scaling replicas does not multiply event write throughput.
- Use external SurrealDB before introducing rolling updates, HPA, or multiple availability zones.

### Additional references

Upstream Celery docs remain useful for broker and serializer options that are not specific to this app.

- Celery configuration docs: <https://docs.celeryq.dev/en/stable/userguide/configuration.html>
