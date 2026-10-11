# Celery Insights Helm chart

Deploy Insights against an existing Celery cluster. By default the chart installs one private, shared in-memory SurrealDB instance through the official SurrealDB chart. Every Insights replica connects to that instance. It provisions no Celery workers, broker, or result backend.

**Release status:** configuration and authentication are integrated with the merged application runtime. Publication remains gated on a matching released application image and hosted SurrealDB Cloud verification. Development installations must explicitly select an image built from this PR.

## First installation

Create one Secret in the installation namespace. Replace every placeholder; never commit real credentials. The database root account is private to provisioning/native diagnostics, and all replicas must use matching credentials.

```sh
kubectl create namespace celery-insights
kubectl -n celery-insights create secret generic celery-insights-credentials \
  --from-literal=broker-url='amqp://USER:PASSWORD@YOUR-BROKER/' \
  --from-literal=result-backend='redis://YOUR-BACKEND:6379/0' \
  --from-literal=surrealdb-root-password='REPLACE-WITH-UNIQUE-PASSWORD' \
  --from-literal=surrealdb-ingester-password='REPLACE-WITH-ANOTHER-PASSWORD' \
  --from-literal=account-password='REPLACE-WITH-ADMIN-PASSWORD' \
  --from-literal=session-secret="$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n')"
```

For development before publication:

```sh
helm repo add surrealdb https://helm.surrealdb.com
helm dependency build charts/celery-insights
helm upgrade --install insights charts/celery-insights \
  --namespace celery-insights --set image.tag=YOUR-PR-IMAGE-TAG \
  --set authentication.publicUrl=https://insights.example.com \
  -f ingress-values.yaml --wait
```

Configure your existing ingress controller and TLS Secret in `ingress-values.yaml`:

```yaml
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: insights.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: insights-tls
      hosts: [insights.example.com]
```

Open `https://insights.example.com/` and sign in as `admin`. Browser sessions require HTTPS and the configured public URL. For local development, provide a local TLS reverse proxy; plain HTTP port-forwarding can check `/health` and `/ready`, but cannot establish browser sessions. The Secret example uses shell arguments for clarity; file-based Secret creation or a secret manager avoids storing credentials in shell history/process arguments.

After a validated chart/image release is published:

```sh
helm upgrade --install insights oci://ghcr.io/danyi1212/charts/celery-insights \
  --version CHART_VERSION --namespace celery-insights --create-namespace --wait
```

Replacing an Insights pod preserves history. Replacing the in-memory database pod loses history. The resource defaults are a starting point for modest workloads, not a capacity guarantee; configure retention and size memory for your workload.

## Configuration files

Each file has one independently selected source. Both files can coexist. Chart-created files use a ConfigMap; put sensitive files in an existing Secret. Helm refuses conflicting sources. Raw content is literal: there is no Helm `tpl` execution or interpolation.

With no custom TOML source, the chart generates a schema-versioned configuration for Basic authentication. Set `authentication.publicUrl` to the exact external HTTPS URL (including a subpath when used). It references the account password and shared session key from the existing Secret. All replicas use the same key; retain it across upgrades to keep sessions valid. Rotating it invalidates existing sessions. Accounts are configured explicitly; no identity database or session PVC is required.

Set `authentication.mode: oidc` with `issuer`, `clientId`, and `roleMappings` under `authentication.oidc`; see [oidc.yaml](examples/oidc.yaml). The default confidential client reads `oidc-client-secret` from the existing Secret. Public clients can set `useClientSecret: false`. Register the HTTPS callback at `PUBLIC_URL/api/auth/callback` with your provider.

Select one of `config.toml.structured`, `content`, `existingConfigMap`, or `existingSecret` to replace the generated **entire** application file. Custom files must include `schema_version`, `installation.public_url`, and authentication configuration. Structured values support nested tables and arrays of accounts/role mappings. Keep `authentication.mode` consistent with your custom file: it controls which standard Secret keys the Deployment references. Use `extraEnv` or Secret file mounts for additional accounts. The file mounts at `/etc/celery-insights/config.toml`, selected with `CELERY_INSIGHTS_CONFIG_FILE`. The application's resolver validates application settings and applies environment overrides; Helm does not duplicate its parser.

Python configuration can coexist with TOML for Celery-specific options:

```yaml
config:
  python:
    content: |
      from pathlib import Path
      broker_url = Path("/etc/celery-insights/celery/broker-url").read_text()
      result_backend = Path("/etc/celery-insights/celery/result-backend").read_text()
      task_serializer = "json"
```

When selecting Python, the chart mounts only the broker/backend Secret keys at these paths and omits their canonical environment overrides. The merged runtime deliberately rejects mixing a legacy Python module with resolved Celery connection settings. Python receives a restricted environment, so read these files rather than broker credentials from environment variables. Do not put Celery connection/options sections in custom TOML when also selecting Python.

Alternatively select `config.python.existingConfigMap` or `existingSecret` and its file `key`. The Python file mounts read-only at `/etc/celery-insights/config.py`. Use `--set-file config.python.content=./config.py` or `--set-file config.toml.content=./config.toml` to migrate existing files. See [configuration.yaml](examples/configuration.yaml) for both together.

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

Disable `surrealdb.enabled` and supply `database.externalUrl`, for example `wss://YOUR-INSTANCE.surreal.cloud/rpc`. Keep credentials in the existing Secret. Use the tested database version and a root-level account named `root` permitted to initialize the application schema; the current application runtime fixes this provisioning username. The chart provisions no cloud account or instance and no external storage.

See [external.yaml](examples/external.yaml). Test Cloud with the final configuration/authentication runtime before using it in production; the external connection path is tested against a separate local database, not a hosted service.

### Credentials and upstream options

The default Secret name and keys are shared by Insights and the upstream database. If you customize `credentials.existingSecret` or the root password key, also update the upstream `surrealdb.podExtraEnv` entries for `SURREAL_PASS` to match; `SURREAL_USER` must remain `root`. Helm validates consistency. This explicit duplication follows the official dependency's interface and keeps rendering independent of cluster lookups.

Root credential rotation in an initialized datastore requires a database user change, not just a Secret update. Apply that change first, then restart the database/application as needed. Do not change bootstrap credentials expecting an existing root account to be recreated.

## Replicas and HPA

Set `replicaCount` or enable `autoscaling` with [autoscaling.yaml](examples/autoscaling.yaml). CPU HPA requires Metrics Server and CPU requests; the chart supplies a starting request. With HPA enabled the Deployment omits its replica count.

Every pod serves APIs independently. Only the elected leader runs ingestion, worker polling, result-backend polling, and automatic cleanup. Lease failures stop the background worker. More replicas increase web capacity/availability, not ingestion throughput. A single managed database remains a single point of failure; install advanced SurrealDB separately if needed.

Core/verbose metrics describe shared Celery history: do not sum identical cluster gauges from every replica. System process metrics describe each API process. Leader ingestion statistics are published to the shared database and served on all replicas, with a 15-second freshness window. Retention updates are shared with the leader; process uptime/memory remain local to each API process.

## Networking and health

ClusterIP with port-forwarding is the default. Configure `service.type: LoadBalancer` or enable `ingress`, with `className`, `hosts`, annotations, and existing TLS Secrets. Configure `config.env.URL_PREFIX` for subpaths and preserve that prefix at the proxy. Terminate TLS at ingress and allow live WebSocket upgrades with suitable idle timeouts.

`/health` reports Bun/process status; `/ready` checks initialized authentication and current database reachability with a bounded query. Neither proves broker connectivity or active ingestion. Startup allows up to five minutes; graceful termination has 30 seconds by default.

## Verification and publication

```sh
helm repo add surrealdb https://helm.surrealdb.com
helm dependency build charts/celery-insights
helm lint --strict charts/celery-insights
uv run python tooling/helm/chart_test.py
```

Kubernetes E2E: create a disposable Kind cluster named `celery-helm`, build/load the app as `celery-insights-helm:e2e` and the existing test harness as `celery-insights-test-project:local`, install Playwright Chromium, and run `uv run python tooling/helm/e2e.py`. The runner only accepts a dedicated Kind context. It owns its fixture namespace and deletes it afterwards; do not use it against a shared cluster.

Publication validates generated Basic/OIDC TOML with the configuration CLI inside the selected released Docker image.

Chart publication is gated by the `celery-insights.io/release-ready` annotation. Set it only after the matching application release and Cloud verification are complete. Chart versions are independent of `appVersion`; trusted `chart-v*` tags publish OCI packages after validation and image availability checks.
