# Celery Insights Helm chart

Deploy Celery Insights on Kubernetes and connect it to your existing Celery broker and result backend. The chart installs an Insights Deployment and one private, shared in-memory SurrealDB instance through the official SurrealDB chart.

All Insights replicas share task history. One elected replica collects Celery events; the others serve the dashboard and APIs. The chart does not install Celery workers, a broker, or a result backend.

## Install

You need Kubernetes 1.30–1.35, Helm 3 or 4, and access to your Celery broker and result backend. For browser sign-in, use an existing ingress controller, a hostname pointing to it, and a TLS Secret in the installation namespace.

### 1. Create the credentials Secret

Replace the broker, backend, and administrator password below. The database passwords and session key are generated locally. Keep the Secret across upgrades: all replicas use the same session key.

```sh
kubectl create namespace celery-insights
kubectl -n celery-insights create secret generic celery-insights-credentials \
  --from-literal=broker-url='amqp://USER:PASSWORD@YOUR-BROKER/' \
  --from-literal=result-backend='redis://YOUR-BACKEND:6379/0' \
  --from-literal=account-password='YOUR-ADMIN-PASSWORD' \
  --from-literal=surrealdb-root-password="$(openssl rand -hex 32)" \
  --from-literal=surrealdb-ingester-password="$(openssl rand -hex 32)" \
  --from-literal=session-secret="$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n')"
```

You can also create this Secret from files or through your secret manager. Credentials belong in Secrets, not Helm values or ConfigMaps.

### 2. Create `values.yaml`

Replace the hostname, ingress class, and TLS Secret name to match your cluster. `authentication.publicUrl` must be the URL users open in their browser.

```yaml
authentication:
  publicUrl: https://insights.example.com
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

### 3. Install and sign in

```sh
helm upgrade --install insights oci://ghcr.io/danyi1212/charts/celery-insights \
  --version 0.1.0 --namespace celery-insights -f values.yaml --wait
```

Open `https://insights.example.com/` and sign in as `admin` with the `account-password` from your Secret. The chart generates the authentication configuration for you.

The default database is in memory. Replacing an Insights pod preserves history; replacing the database pod loses it. Enable persistent storage below if you need history to survive database restarts.

## Keep history on disk

Add this to `values.yaml` **before your first installation**:

```yaml
surrealdb:
  surrealdb:
    path: rocksdb:/data/surreal
  persistence:
    enabled: true
    size: 10Gi
```

The PVC uses the cluster's default StorageClass and remains after Helm uninstall. For an existing PVC, use [existing-claim.yaml](examples/existing-claim.yaml).

Database upgrades interrupt access because the managed instance uses the Recreate strategy. Switching an existing memory database to disk starts fresh history unless you export and restore it. Back up before storage or database upgrades; Helm rollback does not reverse data migrations. Changing StorageClass or shrinking a PVC requires a separate storage migration.

## Use an external database

For a separately managed SurrealDB installation or SurrealDB Cloud, add:

```yaml
surrealdb:
  enabled: false
database:
  externalUrl: wss://YOUR-INSTANCE.surreal.cloud/rpc
```

Use SurrealDB 3.3.0 and put its root password in the `surrealdb-root-password` Secret key. The application provisions its schema using a root-level account named `root`. Confirm your hosted instance allows those operations. The chart connects to the instance; it does not create it or manage its storage and scaling.

## Scale Insights

Set `replicaCount` for a fixed number of pods, or add CPU autoscaling:

```yaml
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 6
  targetCPUUtilizationPercentage: 70
```

CPU HPA needs Metrics Server and CPU requests; the chart provides a default request. Extra replicas add web capacity and availability. One leader still collects events and runs automatic cleanup. The managed database stays a single instance; use an external installation for advanced database scaling.

Size resources and retention for your workload. Cluster history metrics are shared across replicas, so do not sum their identical gauges. Process metrics describe each pod; ingestion diagnostics describe the leader and expire after 15 seconds without an update.

## Configure authentication and Celery

Basic authentication with one `admin` account is the default. Set `authentication.basic.username` and `roles` to change it. To use OIDC, start with [oidc.yaml](examples/oidc.yaml), add `oidc-client-secret` to your Secret, and register `PUBLIC_URL/api/auth/callback` with the provider. For public clients, set `authentication.oidc.useClientSecret: false`. See [authentication documentation](../../src/content/docs/authentication.mdx) for roles and sessions.

The chart generates `config.toml` by default. To supply your own, choose one source:

| Value | Source |
| --- | --- |
| `config.toml.structured` | YAML settings rendered as TOML |
| `config.toml.content` | Literal TOML, including `--set-file config.toml.content=./config.toml` |
| `config.toml.existingConfigMap` | Existing ConfigMap; `config.toml.key` selects the file |
| `config.toml.existingSecret` | Existing Secret; `config.toml.key` selects the file |

A custom TOML source replaces the whole generated file. Include `schema_version`, `installation.public_url`, and authentication settings. Keep `authentication.mode` in Helm values consistent with the file so the chart selects the right Secret keys. See [configuration.yaml](examples/configuration.yaml) and the [application configuration reference](../../CONFIGURATION.md).

You can also supply `config.py` alongside TOML using `config.python.content`, `existingConfigMap`, or `existingSecret`. For example:

```yaml
config:
  python:
    content: |
      from pathlib import Path
      broker_url = Path("/etc/celery-insights/celery/broker-url").read_text()
      result_backend = Path("/etc/celery-insights/celery/result-backend").read_text()
      task_serializer = "json"
```

With Python selected, Celery connection settings come from that module and the chart mounts the broker/backend Secret files above. Do not also set Celery connection or option settings in TOML. Python receives a restricted environment, so use these files for credentials.

Both configuration files mount read-only at `/etc/celery-insights/`. Raw file content is used literally. Use `config.env` for non-sensitive environment settings, `extraEnv` with Secret references for extra credentials, and `extraVolumes`/`extraVolumeMounts` for certificates or other secret files.

## Upgrade and maintain

Keep your settings in `values.yaml` and apply changes with the same install command. Chart-managed configuration changes restart the pods automatically. After editing an existing Secret or ConfigMap, restart Insights:

```sh
kubectl -n celery-insights rollout restart deployment/insights-celery-insights
```

Rotating the shared session key signs everyone out. Changing an initialized database's root password requires updating the database account before changing its Secret. If you rename the credentials Secret or its root-password key, also update `surrealdb.podExtraEnv` for `SURREAL_PASS`; `SURREAL_USER` stays `root`.

For a subpath, set `authentication.publicUrl` to the full HTTPS URL and `config.env.URL_PREFIX` to its path. Preserve that prefix at ingress and allow WebSocket upgrades. Plain HTTP port-forwarding can check `/health` and `/ready`, but browser sessions require HTTPS.

`/health` reports process status. `/ready` checks initialized authentication and database access; it does not prove broker connectivity or active ingestion.

For local chart development and release checks, see [CONTRIBUTING.md](../../CONTRIBUTING.md#helm-chart-development).
