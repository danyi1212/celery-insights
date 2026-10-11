# Custom authorization with OPA

Use OPA to restrict what configured accounts can see or do:

- **Roles grant permissions; OPA can only restrict them.** Access requires both to allow it.
- OPA is optional. Without a decision URL, built-in roles apply.
- You run OPA; Celery Insights queries it from Bun. Python receives no policy configuration.

## Connect OPA

Add this to your installation TOML:

```toml
[authorization.opa]
decision_url = "http://opa:8181/v1/data/celery_insights/allow"
timeout_ms = 1000
```

- Use `127.0.0.1` for a sidecar, or a private service name for separate containers.
- Keep OPA's administrative API and the app's direct database/bridge listeners private.
- Roll out all app replicas after changing TOML. Updates to OPA policies apply on subsequent checks without restarting Insights.
- Decisions are never cached or retried. Keep policies consistent across OPA replicas.

For a remote endpoint, use HTTPS and a mounted token:

```toml
[authorization.opa]
decision_url = "https://policy.example.com/v1/data/celery_insights/allow"
bearer_token_file = "/run/secrets/insights/opa-token"
timeout_ms = 1000
```

`bearer_token` is also supported. Environment overrides are `CELERY_INSIGHTS_OPA_BEARER_TOKEN` and `CELERY_INSIGHTS_OPA_BEARER_TOKEN_FILE`. Relative file paths resolve from the TOML directory. Tokens require HTTPS and are excluded from diagnostics.

The URL must have a `/v1/data/...` path, without credentials, query or fragment. TLS validation stays enabled; redirects are rejected. Timeouts must be 50–10000 ms and cover the whole response.

## Example: prevent maintenance changes

Save this as `policy.rego`. Account `monitor` keeps its role-permitted reads but cannot restore backups, clear history, change retention or run cleanup:

```rego
package celery_insights
import rego.v1

default allow := false

allow if {
    input.version == 1
    not restricted
}

restricted if {
    input.principal.account_id == "monitor"
    some action in input.actions
    action in {"backup.import", "history.clear", "retention.update", "cleanup.run"}
}
```

Try it locally:

```sh
docker run --rm -p 127.0.0.1:8181:8181 \
  -v "$PWD/policy.rego:/policies/policy.rego:ro" \
  openpolicyagent/opa:1.21.1 run --server --addr=0.0.0.0:8181 /policies/policy.rego

curl --fail-with-body http://127.0.0.1:8181/v1/data/celery_insights/allow \
  -H 'Content-Type: application/json' \
  --data '{"input":{"version":1,"principal":{"account_id":"monitor"},"actions":["history.clear"]}}'
# {"result":false}
```

This published, unauthenticated endpoint is for local testing. Use private access in production.

## Example: show only reporting tasks

Replace the policy above with this one. `monitor` sees reporting tasks on one worker, with sensitive payloads removed; other accounts keep their role grants:

```rego
package celery_insights
import rego.v1

default allow := false

allow := {"allow": true, "scope": {
    "task_types": ["reports.render"],
    "task_workers": ["celery@reports"],
    "worker_hostnames": ["celery@reports"],
    "deny_fields": [
        "task.input.read", "task.result.read", "task.failure.read",
        "event.raw.read", "worker.inspect.read",
    ],
}} if {
    input.version == 1
    input.principal.account_id == "monitor"
}

allow := true if {
    input.version == 1
    input.principal.account_id != "monitor"
}
```

Scope selectors use exact matches:

| Selector | Restricts |
| --- | --- |
| `task_ids` | Celery task IDs, without a database table prefix |
| `task_types` | Task type names |
| `task_workers` | Worker names on tasks |
| `worker_hostnames` | Worker record IDs; combine with `task_workers` to also restrict tasks |
| `deny_fields` | The five payload groups in the example above |

- Selectors intersect. Omitted selectors are unrestricted; `[]` allows no records.
- Each selector accepts up to 100 nonempty strings, each at most 256 characters. Wildcards, expressions and unknown keys are rejected.
- Filtering happens **before** search, counts, analytics, pagination and exports. Roles still limit returned fields.
- Task scopes hide workflow relationships and cross-task summaries. Restricted scopes also omit opaque event/inspection payloads; row scopes omit worker task counters.
- Global diagnostics and maintenance writes require unrestricted access. Scoped metrics exclude hidden rows; system metrics are denied for row scopes.

## What OPA receives

Insights POSTs this versioned input to the decision URL:

```json
{
  "input": {
    "version": 1,
    "principal": { "account_id": "monitor", "roles": ["administrator"] },
    "actions": ["metrics.read"],
    "request": { "method": "GET", "path": "/metrics", "transport": "http" },
    "installation": { "replay": false }
  }
}
```

- `actions`: every permission required for the operation. Navigation and identity checks have an empty list.
- `account_id`: case-sensitive username, or `oidc:<subject>` for OIDC. Each installation serves one cluster.
- `path`: excludes the deployment prefix and query string.
- `transport`: `http`, `websocket` or `mcp`. Tool checks add `request.tool`; typed reads add `request.operation`.
- No passwords, user headers, request bodies, task payloads, resource IDs or client IPs are sent. OPA decision logs can contain account IDs.

Return one of these:

```json
{"result": true}
```

```json
{"result": false}
```

```json
{"result": {"allow": true, "scope": {"task_types": ["reports.render"]}}}
```

- `true`: allow within role grants; `false`: deny with **403**.
- Missing/invalid results, invalid scopes, responses over 16 KiB, timeouts and connection errors: **503**, with the operation blocked.
- There is no fail-open mode. `/health`, public assets and logout remain available during an outage.

## Where checks apply

Checks cover browser navigation, APIs, typed observation reads, WebSocket connections, exports, metrics and MCP tools.

| Action group | Permissions |
| --- | --- |
| Task and worker metadata | `task.metadata.read`, `worker.metadata.read` |
| Sensitive payloads | `task.input.read`, `task.result.read`, `task.failure.read`, `event.raw.read`, `worker.inspect.read` |
| Analytics and retention overview | `analytics.read` |
| CSV export | `task.export` plus all metadata/payload permissions |
| Backups | `backup.export` plus all metadata/payload permissions; `backup.import` for restore |
| Maintenance | `history.clear`, `retention.update`, `cleanup.run` |
| Diagnostics | `diagnostics.export`; bundles also require backup and all metadata/payload permissions |
| Metrics | `metrics.read`; verbose metrics additionally require task/worker metadata and failure access |
| MCP | All metadata/payload permissions, plus a separate decision for each tool |

- Arbitrary SQL, database sign-in, writes and `/surreal/*` access are denied. Observation reads use Bun's validated operations.
- Replay writes and `diagnostics.secrets.export` are always forbidden, regardless of policy.
- Internal ingestion, polling and scheduled cleanup use deployment configuration, not user policies.
- Live connections recheck messages, replies and every five seconds. A changed scope, denial or outage closes the connection and clears the browser's observation cache. Previously delivered data cannot be recalled.
- Exports are checked before execution. MCP cursors become invalid if the account or scope changes.

## What users see

- Browser preferences remain editable by viewers; they affect only that browser.
- Roles hide or disable unavailable management controls. OPA evaluates each request, so a visible control can still receive a policy denial.
- Omitted payloads and workflow relationships show as **restricted**. Hidden records appear absent.
- Access denial and policy outages show distinct messages with retry and sign-out options. The session stays active; recovery does not require logging in again.

More runnable policies and their tests are in [examples/opa](examples/opa), including payload vetoes and MCP tool restrictions. Load one example policy at a time.

To check your integration:

```sh
bunx vitest run runtime/security
bun run e2e
URL_PREFIX=/tools/celery bun run e2e
```
