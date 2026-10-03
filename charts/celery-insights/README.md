# Celery Insights Helm chart

Deploy Insights against an existing Celery cluster. By default the chart installs one private, shared in-memory SurrealDB instance through the official SurrealDB chart. Every Insights replica connects to that instance. It provisions no Celery workers, broker, or result backend.

**Release status:** this chart is a draft. The selected released image must include the runtime changes in this PR. TOML and application-wide authentication depend on [#138](https://github.com/danyi1212/celery-insights/issues/138) and [#139](https://github.com/danyi1212/celery-insights/issues/139). The current compatibility profile uses environment configuration and the legacy dashboard password. That password protects browser database access; it does not provide application-wide API authorization. Keep this profile on trusted networks. Cloud compatibility has not yet been verified.

## First installation

Create one Secret in the installation namespace. Replace every placeholder; never commit real credentials. The database root account is private to provisioning/native diagnostics, and all replicas must use matching credentials.

```sh
kubectl create namespace celery-insights
kubectl -n celery-insights create secret generic celery-insights-credentials \
  --from-literal=broker-url='amqp://USER:PASSWORD@YOUR-BROKER/' \
  --from-literal=result-backend='redis://YOUR-BACKEND:6379/0' \
  --from-literal=surrealdb-root-user='insights-admin' \
  --from-literal=surrealdb-root-password='REPLACE-WITH-UNIQUE-PASSWORD' \
  --from-literal=surrealdb-ingester-password='REPLACE-WITH-ANOTHER-PASSWORD' \
  --from-literal=frontend-password='REPLACE-WITH-DASHBOARD-PASSWORD'
```

For development before publication:

```sh
helm repo add surrealdb https://helm.surrealdb.com
helm dependency build charts/celery-insights
helm upgrade --install insights charts/celery-insights \
  --namespace celery-insights --set image.tag=YOUR-PR-IMAGE-TAG --wait
kubectl -n celery-insights port-forward service/insights-celery-insights 8555:80
```

Open `http://localhost:8555/` and enter the dashboard password. The Secret example uses shell arguments for clarity; file-based Secret creation or a secret manager avoids storing credentials in shell history/process arguments.

After a validated chart/image release is published:

```sh
helm upgrade --install insights oci://ghcr.io/danyi1212/charts/celery-insights \
  --version CHART_VERSION --namespace celery-insights --create-namespace --wait
```

Replacing an Insights pod preserves history. Replacing the in-memory database pod loses history. The resource defaults are a starting point for modest workloads, not a capacity guarantee; configure retention and size memory for your workload.

## Configuration files

Each file has one independently selected source. Both files can coexist. Chart-created files use a ConfigMap; put sensitive files in an existing Secret. Helm refuses conflicting sources. Raw content is literal: there is no Helm `tpl` execution or interpolation.

Python configuration works with the current application and takes precedence over its broker/backend environment defaults:

```yaml
config:
  python:
    content: |
      import os
      broker_url = os.environ["BROKER_URL"]
      result_backend = os.environ["RESULT_BACKEND"]
      task_serializer = "json"
```

Alternatively use `config.python.existingConfigMap` or `config.python.existingSecret` and the `key` containing the file. Files mount read-only at `/etc/celery-insights/config.py`.

For an image implementing #138, choose `config.toml.enabled: true` and either `structured`, `content`, `existingConfigMap`, or `existingSecret`. See [configuration.yaml](examples/configuration.yaml). Structured values recursively render canonical TOML tables and scalars. Use raw TOML for advanced syntax such as arrays of tables. A selected TOML file mounts at `/etc/celery-insights/config.toml` through `CI_CONFIG_FILE`. The current runtime deliberately rejects that selection instead of silently ignoring it.

Use `--set-file config.python.content=./config.py` or `--set config.toml.enabled=true --set-file config.toml.content=./config.toml` to migrate existing files. Follow #138's final source precedence and registered secret-file/environment interfaces; this chart does not implement a second application parser. Unknown structured application keys must be rejected by the application's validation.

`config.env` is for non-sensitive runtime settings. Use `extraEnv` with `valueFrom.secretKeyRef` for additional secret overrides and `extraVolumes`/`extraVolumeMounts` for certificate or registered secret files. Do not include secrets in `structured`, raw ConfigMap content, or Helm values. Chart-owned connection/topology variables cannot be duplicated.

Changes to chart-managed files update the pod checksum and roll Insights. Existing Secrets/ConfigMaps are not watched: use `kubectl rollout restart deployment/insights-celery-insights` after modifying them. Secret/file mounts use `subPath`, so replacement requires a rollout even if the application later adds file watching.

## Database profiles

### Persistent single instance

Use [persistent.yaml](examples/persistent.yaml). Both a disk-backed datastore path and a PVC must be selected:

```sh
helm upgrade insights charts/celery-insights -n celery-insights \
  -f charts/celery-insights/examples/persistent.yaml --wait
```

The upstream PVC defaults to 10 GiB, the cluster's default StorageClass, and ReadWriteOnce. Its `helm.sh/resource-policy: keep` annotation retains it on uninstall. Delete retained claims only after deliberately disposing of the history. Changing storage class or shrinking capacity is not an in-place Helm operation.

An existing claim uses the upstream `volumes` and `volumeMounts` interface; see [existing-claim.yaml](examples/existing-claim.yaml). Helm neither adopts nor deletes that claim. Filesystem ownership uses the verified upstream UID/GID 65532 and `fsGroup`.

SurrealDB uses Recreate, so upgrades interrupt database access. Switching from memory to disk starts a fresh history store unless you explicitly export and restore data. Helm rollback does not undo schema migrations or database storage formats. Back up before database upgrades.

### External or SurrealDB Cloud

Disable `surrealdb.enabled` and supply `database.externalUrl`, for example `wss://YOUR-INSTANCE.surreal.cloud/rpc`. Keep credentials in the existing Secret. Use the tested database version and an administrative account permitted to initialize the application schema. The chart provisions no cloud account or instance and no external storage.

See [external.yaml](examples/external.yaml). Test Cloud with the final configuration/authentication runtime before using it in production; the external connection path is tested against a separate local database, not a hosted service.

### Credentials and upstream options

The default Secret name and keys are shared by Insights and the upstream database. If you customize `credentials.existingSecret` or root credential keys, also update the upstream `surrealdb.podExtraEnv` entries for `SURREAL_USER` and `SURREAL_PASS` to match. Helm validates consistency. This explicit duplication follows the official dependency's interface and keeps rendering independent of cluster lookups.

Root credential rotation in an initialized datastore requires a database user change, not just a Secret update. Apply that change first, then restart the database/application as needed. Do not change bootstrap credentials expecting an existing root account to be recreated.

## Replicas and HPA

Set `replicaCount` or enable `autoscaling` with [autoscaling.yaml](examples/autoscaling.yaml). CPU HPA requires Metrics Server and CPU requests; the chart supplies a starting request. With HPA enabled the Deployment omits its replica count.

Every pod serves APIs independently. Only the elected leader runs ingestion, worker polling, result-backend polling, and automatic cleanup. Lease failures stop the background worker. More replicas increase web capacity/availability, not ingestion throughput. A single managed database remains a single point of failure; install advanced SurrealDB separately if needed.

Core/verbose metrics describe shared Celery history: do not sum identical cluster gauges from every replica. System process metrics describe each API process. Leader ingestion statistics are published to the shared database and served on all replicas, with a 15-second freshness window. Retention updates are shared with the leader; process uptime/memory remain local to each API process.

#139 requires durable, shared identity/control state even when observation history is in memory. That storage contract is an explicit release prerequisite. Do not deploy production authentication onto the default ephemeral observation store or bypass auth to preserve the demo defaults.

## Networking and health

ClusterIP with port-forwarding is the default. Configure `service.type: LoadBalancer` or enable `ingress`, with `className`, `hosts`, annotations, and existing TLS Secrets. Configure `config.env.URL_PREFIX` for subpaths and preserve that prefix at the proxy. Terminate TLS at ingress and allow live WebSocket upgrades with suitable idle timeouts.

`/health` reports Bun/process status; `/ready` checks that Python's HTTP API responds. Neither proves broker connectivity, active ingestion, or continuing database reachability. Startup allows up to five minutes; graceful termination has 30 seconds by default.

## Verification and publication

```sh
helm repo add surrealdb https://helm.surrealdb.com
helm dependency build charts/celery-insights
helm lint --strict charts/celery-insights
uv run python tooling/helm/chart_test.py
```

Kubernetes E2E: create a disposable Kind cluster named `celery-helm`, build/load the app as `celery-insights-helm:e2e` and the existing test harness as `celery-insights-test-project:local`, install Playwright Chromium, and run `uv run python tooling/helm/e2e.py`. The runner only accepts a dedicated Kind context. It owns its fixture namespace and deletes it afterwards; do not use it against a shared cluster.

Chart publication is gated by the `celery-insights.io/release-ready` annotation. Set it only after #138/#139 compatibility, durable auth setup, the matching application release, and Cloud verification are complete. Chart versions are independent of `appVersion`; trusted `chart-v*` tags publish OCI packages after validation and image availability checks.
