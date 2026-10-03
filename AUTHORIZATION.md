# Custom authorization with OPA

Celery Insights can query an operator-managed Open Policy Agent (OPA) service before serving an authenticated operation. Built-in roles remain the permission ceiling: **role allow AND OPA allow**. OPA cannot grant missing permissions or enable replay writes. Without a decision URL, built-in authorization works unchanged. No OPA dependency is installed in the application, and Python does not receive policy settings or credentials.

## Configure the installation

Add this table to the existing authentication TOML:

```toml
[authorization.opa]
decision_url = "http://opa:8181/v1/data/celery_insights/allow"
timeout_ms = 1000
```

The decision URL must use HTTP(S) and a `/v1/data/...` path; URL credentials, queries and fragments are rejected. Timeout is 50–10000 ms and covers the connection and response body. Configuration is resolved at startup; roll out all replicas when changing it. Run OPA beside the application or behind a private cluster Service, with consistent policy/data across replicas. Policy updates in OPA take effect on subsequent checks without restarting Insights. Decisions are not cached or retried.

For an authenticated remote OPA endpoint, use HTTPS and one of `bearer_token` or `bearer_token_file`. A relative file path resolves relative to TOML. `CELERY_INSIGHTS_OPA_BEARER_TOKEN` or its `_FILE` variant can override the value. Credentials require HTTPS, never enter Python or diagnostics (even secret-inclusive exports), and are never taken from the user's Authorization header. Standard certificate validation stays enabled; redirects are rejected.

```toml
[authorization.opa]
decision_url = "https://policy.example.com/v1/data/celery_insights/allow"
bearer_token_file = "/run/secrets/insights/opa-token"
timeout_ms = 1000
```

Mount the token from a Kubernetes Secret or your deployment's secret mechanism. For a local sidecar, use `http://127.0.0.1:8181/v1/data/celery_insights/allow`. For separate containers, use the private OPA service name. Do not publish OPA's administrative API to application users. Use network policy or an authenticated proxy to restrict Insights to decision queries; management/bundle access belongs to your operators. OPA decision logging is operator-owned and includes account identifiers.

## Decision contract (version 1)

Insights POSTs the following JSON to the configured URL, using OPA's [Data API](https://www.openpolicyagent.org/docs/rest-api#data-api):

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

`actions` lists **every** built-in permission required for the operation. Return one boolean decision for the entire operation. `request.path` excludes the configured deployment prefix and query string. `transport` is `http`, `websocket`, or `mcp`; tool checks also include `request.tool`. No password, user headers, URL query, body, task payload, client IP, or resource identifier is sent. Account identifiers are case-sensitive configured usernames. There is one cluster per installation.

Only a successful HTTP response containing `{"result":true}` allows access. `false` returns 403. Undefined rules, missing results, non-boolean values, malformed/oversized responses (over 16 KiB), HTTP/network/TLS errors and timeouts return 503 and prevent the operation. Error details and credentials are not exposed. An OPA outage blocks protected operations and browser navigation; `/health` and public assets remain available. There is no fail-open mode. MCP tool vetoes use its standard `isError` result with `access_denied` or `unavailable`, rather than dispatching the tool.

## Enforcement coverage

| Operation | Required permissions |
| --- | --- |
| Navigation and `GET /api/auth/identity` | Empty actions; policies can still deny the principal or path |
| `GET /api/config` | All payload permissions |
| `GET /api/settings/info`, `/api/settings/debug-snapshot` | `diagnostics.export` |
| `POST /api/settings/download-debug-bundle` | `diagnostics.export`, `backup.export`, all payload permissions |
| `POST /api/settings/clear` | `history.clear` |
| `GET /api/settings/export` | `backup.export`, all payload permissions |
| `POST /api/settings/import` | `backup.import` |
| `GET /api/settings/retention` | `analytics.read` |
| `PUT /api/settings/retention` | `retention.update`, `analytics.read` |
| `POST /api/settings/cleanup` | `cleanup.run`, `analytics.read` |
| `POST /api/exports/csv` | `task.export`, all payload permissions |
| `GET /metrics`, `/metrics/system` | `metrics.read` |
| `GET /metrics/verbose` | `metrics.read`, `task.metadata.read`, `worker.metadata.read`, `task.failure.read` |
| Database RPC HTTP reads and WebSocket upgrade/messages/delivery | All payload permissions |
| `/mcp` and every tool call | All payload permissions; tool calls additionally identify their tool |

All payload permissions means `task.metadata.read`, `task.input.read`, `task.result.read`, `task.failure.read`, `event.raw.read`, `worker.metadata.read`, and `worker.inspect.read`. Unknown application/API transports remain denied. `diagnostics.secrets.export` is always forbidden. Origin and mutation-header checks run before policy queries.

Identity's `permissions` list describes role grants, not a prediction of contextual OPA decisions. The server checks each operation independently. UI controls may remain visible even when a policy denies their request. Periodic ingestion/polling and automatic retention cleanup are internal service work, unaffected by user policies; disable/configure them through deployment settings if needed.

Live connections recheck on opening, each client message, and before each backend delivery. Denial or policy failure closes them with code 1008 and discards pending data. Checks preserve message order with at most 64 queued messages per direction; overload also closes the connection. An idle connection is checked on its next activity. Decisions already approved may finish; this is not transaction-time revocation. Large exports/HTTP responses receive one check before execution, not a per-chunk check.

**Current scope:** browser RPC and MCP need all payload grants. Policies can deny browsing, payload access, individual MCP tools, exports or mutations, but cannot filter rows, redact fields, restrict individual task IDs, or rewrite queries. Denying any payload permission denies the entire broad transport/export. Typed reads and streams are required before resource-specific authorization can be offered. Viewer/operator UI browsing remains incomplete. Ingress must keep direct Bun/database/bridge listeners private; bypassing Bun bypasses policy enforcement.

## Rego examples

Each example is an independent policy defining `data.celery_insights.allow`; load **one** at a time. They use [Rego v1](https://www.openpolicyagent.org/docs/policy-language), default deny unknown input versions, and allow normal role-permitted operations except their stated restrictions:

- [Block monitoring-account mutations](examples/opa/maintenance.rego): deny restore, clear, retention changes and manual cleanup for `monitor`.
- [Block sensitive payload access](examples/opa/no-payload.rego): deny broad browsing/MCP/exports for `monitor`, while role-permitted metrics and metadata remain possible.
- [Limit an agent to one MCP tool](examples/opa/mcp-tools.rego): only `list_workers` is permitted for account `agent` through MCP. Other application transports remain role-permitted; combine with endpoint restrictions if the account must be MCP-only.

Example local Docker smoke test using the version exercised by the E2E suite:

```sh
docker run --rm -p 127.0.0.1:8181:8181 \
  -v "$PWD/examples/opa/maintenance.rego:/policies/policy.rego:ro" \
  openpolicyagent/opa:1.21.1 run --server --addr=0.0.0.0:8181 /policies/policy.rego
```

```sh
curl --fail-with-body http://127.0.0.1:8181/v1/data/celery_insights/allow \
  -H 'Content-Type: application/json' \
  --data '{"input":{"version":1,"principal":{"account_id":"monitor","roles":["administrator"]},"actions":["history.clear"],"request":{"method":"POST","path":"/api/settings/clear","transport":"http"},"installation":{"replay":false}}}'
# {"result":false}
```

Do not use this unauthenticated published API beyond a local smoke test. Production should use private sidecar/Service access and operator-managed policy distribution.

## Verification

Unit tests cover role ceilings, replay and secret-export restrictions, every registered route, the credential-free input contract, normalized prefixes, strict responses, body limits, deadlines and live ordering/overload. Real OPA E2E scenarios deny each permission required at each registered API, broad HTTP RPC, navigation/identity, all five MCP tools, and WebSocket upgrades/active delivery; verify viewer grants cannot expand, denied writes leave retention/history intact, and policy outage/malformed decisions fail closed. Existing root and shared-proxy browser suites run with OPA enabled to exercise permitted operations too.

```sh
bunx vitest run runtime/security
bun run e2e
URL_PREFIX=/tools/celery bun run e2e
```
