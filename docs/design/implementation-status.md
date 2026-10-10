# Implementation status

## Runtime prerequisites in PR #146

Python retains Celery ingestion, worker/result polling and a private Unix-socket bridge protected by its owner-only directory. Application account secrets never enter its configuration or inherited environment. Bun owns settings, observation backup/restore, CSV exports, retention and metrics.

## Authentication in PR #143 (stacked on #146)

Bun resolves configured password accounts or explicitly mapped OIDC principals and gates browser navigation, application APIs, metrics, MCP and database RPC. Credentials and roles come only from TOML; each password is inline or referenced from a file/environment variable. Native constant-time comparison verifies credentials. Browsers sign in through a native form and use shared encrypted, expiring cookies implemented with `jose`; `openid-client` implements OIDC discovery/exchange/token validation. There are no password hashes, MFA, recovery codes, account database, bootstrap or management UI.

Origin and custom-header checks protect mutations; WebSocket upgrades require Origin. Role checks, unknown-route denial, replay write restrictions and no-store responses remain in Bun. Live delivery checks the configured account and payload permissions by reauthenticating the original upgrade request, including cookie expiry. All replicas use the same configuration; rotating/removing accounts requires a rollout.

The previous frontend database password/login/token path has been retired. Legacy `SURREALDB_FRONTEND_PASS` fails with migration guidance. Database viewer transport remains temporarily behind Bun and requires all payload permissions. Public SQL/import/export routes are denied.

Session tests cover replicas, credential/configuration rotation, expiry, secure cookie attributes, constrained return paths, login/logout CSRF, bounded input and real RSA-signed OIDC tokens with invalid issuer, audience, state, nonce and unmapped roles. Browser E2E uses the login form for normal application navigation.

## Verification

Configuration tests cover all three password sources, missing/conflicting sources, invalid roles, duplicates, obsolete settings and secret exclusion from Python/diagnostics. Request tests cover login redirects and cookies, invalid credentials, roles, browser navigation, Origin/custom-header enforcement, unknown operations, WebSockets and prefixes. Native Bun acceptance covers independent configured replicas, credential rotation and real observation metrics/CSV/backup/restore/cleanup on disposable SurrealDB 3.3.0. TLS browser suites exercise root and shared-prefix deployments without an identity database or provisioning service.

```sh
SURREAL_BINARY=/path/to/surreal-3.3.0 bun run test:observation
bun run test:security
```

## Planned work

- Typed task/event/worker reads and authorized streams, replacing browser database credentials and arbitrary RPC. Viewer/operator UI browsing and resource/field restrictions are incomplete.
- Restrictive OPA queries and equivalent read/export/stream scope enforcement (#140).
- Shared durable retention configuration and ingestion-leader fencing. Retention UI edits remain process-local.

Green checks verify implemented behavior; OPA and restricted-role browsing are not advertised as completed capabilities.
