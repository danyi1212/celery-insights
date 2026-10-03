# Authentication and authorization plan

One Celery cluster per installation. Bun owns deployment configuration and public application requests. Python owns the private Celery bridge. Celery Insights is an operator-deployed application, not an identity provider.

## Responsibilities

Provide configured HTTP Basic accounts for simple deployments and integrate external OIDC for deployments that need SSO, MFA or account lifecycle management. Keep application roles, permission enforcement and optional OPA decisions in Bun. Never implement password hashing, enrollment, recovery, account management or an identity database.

## Configured accounts (PR #143)

```toml
schema_version = 1
installation.public_url = "https://insights.example.com/tools/celery/"
server.url_prefix = "/tools/celery"
authentication.mode = "basic"

[[authentication.accounts]]
username = "admin"
password_file = "/run/secrets/insights/admin-password"
roles = ["administrator"]

[[authentication.accounts]]
username = "reader"
password_env = "INSIGHTS_READER_PASSWORD"
roles = ["viewer"]
```

Each account selects exactly one source: `password`, `password_file`, or `password_env`. A file reference is relative to the TOML file; remove exactly one terminal LF/CRLF. An environment reference names an existing variable; missing/empty values fail startup without fallback. Inline passwords are accepted for operators who keep the whole TOML file secret. Usernames are unique and case-sensitive; roles are explicit. No accounts or passwords are supplied implicitly.

Bun resolves secrets once at startup. All replicas receive the same deployment configuration. Changes, removals and rotation require rollout of every replica; connections end with their process. There is no live account API, bootstrap state, account reconciliation, session database, MFA keyring or recovery operation. Secrets remain in Bun and are excluded from Python, config output, errors, backup and diagnostic exports, including exports requesting secrets.

HTTP Basic credentials are verified on requests with the native constant-time comparison primitive. Browser navigation receives a challenge before the UI loads. The browser manages the credential cache; the application never stores credentials in browser storage. Basic has no portable application logout or session expiry. Use OIDC when those capabilities are needed.

Require an HTTPS public URL and deploy HTTPS ingress. Keep Bun and database listeners inaccessible outside the trusted ingress/network. Do not infer trust from client-supplied forwarding headers. The ingress must preserve Authorization and Origin. Reject foreign Origin and cross-site requests. Browser mutations require exact configured Origin plus `X-Celery-Insights-Request: 1`; WebSockets require exact Origin. Configure ingress rate limits if login-attempt limiting is needed; there is no custom distributed login throttle.

## Application authorization

Use one authenticated principal containing account identifier and builtin roles. Unknown application operations deny access. Check grants before dispatch and validate account authority for live delivery. Keep replay mutations prohibited and protected responses uncached. Keep public `/health` independent of authentication.

The current browser SurrealDB RPC transport exposes all task payload fields. It therefore requires all payload grants, which currently means administrator access. Viewer and operator UI browsing is incomplete; adding accounts does not imply field-level enforcement. Replace browser database credentials/arbitrary RPC with typed task, event and worker reads and authorized streams before claiming restricted-role browsing or OPA resource/field restrictions. Public SQL/import/export transports remain denied.

## OIDC follow-up

OIDC is planned, not implemented by PR #143. Selecting `oidc` fails startup; it never falls back to Basic. Use a maintained OIDC client/integration rather than writing protocol or token-validation code. Account creation, passwords, MFA and recovery stay at the customer's IdP; support standard providers without requiring Keycloak-specific administration APIs.

Resolve principals from verified issuer and subject, with explicitly configured claim/group-to-role mapping and default deny. Validate the configured issuer, audience and authentication response using the integration library. Test callback state/nonce/PKCE, key rotation, redirect restrictions, logout, expiry and live-connection authorization. Document the library's session model and its multi-replica/revocation tradeoffs. Never accept identity from untrusted headers or silently link accounts by email. Avoid introducing a second custom session engine alongside the library.

## Restrictive OPA policies (#140)

Bun asks OPA about an authenticated principal, required actions and normalized operation context after builtin permission checks. OPA can restrict builtin grants, never enlarge them. Strict boolean responses, bounded deadlines and response sizes fail closed. Policies and their deployment remain operator-owned. Queries cover APIs, broad RPC, exports, individual MCP tools and live messages/delivery. See [the implemented contract](../../AUTHORIZATION.md). No resource identifiers or field filtering are supported until typed observation reads/streams replace broad RPC.

## Delivery plan

1. Land the TOML resolver and strict Python handoff (#142, merged).
2. Simplify #143 to configured Basic accounts, request authorization and the private Python bridge. Remove old identity modules, settings, frontend login and lifecycle tests. Verify real Basic browser/WebSocket traffic at root and a shared prefix over TLS.
3. Add optional restrictive OPA queries across existing request and live gates.
4. Introduce typed observation reads/streams and retire browser DB credentials; verify restricted-role reads cannot expose payloads through another transport.
5. Add maintained OIDC integration and deployment documentation with provider-managed lifecycle.
6. Extend OPA with resource/field enforcement across the typed transports.

Do not ship unsupported modes, direct database access or anonymous fallbacks as compatibility bypasses. Existing frontend-password deployments must explicitly configure accounts before upgrading.
