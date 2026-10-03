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
authentication.session.secret_file = "/run/secrets/insights/session-secret"

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

The browser signs in using an accessible native form and receives an encrypted/authenticated HttpOnly/Secure/SameSite=Lax cookie. Bun compares configured passwords with the native constant-time primitive; there are no password hashes or identity records. Explicit Basic headers remain available to programmatic clients without WWW-Authenticate challenges. A shared 32-byte base64url session secret is mandatory; never generate a per-pod fallback. `jose` implements authenticated cookie encryption and expiry.

Sessions carry identity, expiry and a keyed configuration revocation tag. Password/account/configuration changes or secret rotation invalidate them on rollout. OIDC cookies carry mapped roles, never provider tokens. Logout clears the browser cookie; copied cookies remain valid until expiry or configuration rotation. There is no per-session revocation database. OIDC provider role/account changes take effect at session expiry or next sign-in; default lifetime is eight hours, configurable from five minutes to one day. Live connections reauthenticate their upgrade request before forwarding messages/delivery so expired cookies cannot keep a connection authorized.
Require an HTTPS public URL and deploy HTTPS ingress. Keep Bun and database listeners inaccessible outside the trusted ingress/network. Do not infer trust from client-supplied forwarding headers. The ingress must preserve Authorization and Origin. Reject foreign Origin and cross-site requests. Browser mutations require exact configured Origin plus `X-Celery-Insights-Request: 1`; WebSockets require exact Origin. Configure ingress rate limits if login-attempt limiting is needed; there is no custom distributed login throttle.

## Application authorization

Use one authenticated principal containing account identifier and builtin roles. Unknown application operations deny access. Check grants before dispatch and validate account authority for live delivery. Keep replay mutations prohibited and protected responses uncached. Keep public `/health` independent of authentication.

The current browser SurrealDB RPC transport exposes all task payload fields. It therefore requires all payload grants, which currently means administrator access. Viewer and operator UI browsing is incomplete; adding accounts does not imply field-level enforcement. Replace browser database credentials/arbitrary RPC with typed task, event and worker reads and authorized streams before claiming restricted-role browsing or OPA resource/field restrictions. Public SQL/import/export transports remain denied.

## OIDC integration (PR #143)

`openid-client` owns discovery, authorization code flow with PKCE, state/nonce and ID-token signature/issuer/audience checks. Use HTTPS issuer and endpoints; no insecure TLS fallback. A five-minute encrypted, browser-bound transaction cookie carries PKCE/state/nonce and a constrained return path, enabling callbacks to land on any replica. Transactions use the provider's one-time authorization code. Provider access/refresh tokens are discarded.

Configure issuer, client ID, optional client secret (`client_secret_post`) and explicit top-level claim-to-role mappings. Mappings support a string or string array; no mapping means no access. Identify users by issuer-bound subject, never email. Password and OIDC modes are exclusive. The IdP owns all account lifecycle operations and MFA; app logout clears only its own session. See the configuration guide for Kubernetes-secret inputs and an OIDC example.

## Restrictive OPA policies (#140)

Bun asks OPA about an authenticated principal, required actions and normalized operation context after builtin permission checks. OPA can restrict builtin grants, never enlarge them. Strict boolean responses, bounded deadlines and response sizes fail closed. Policies and their deployment remain operator-owned. Queries cover APIs, broad RPC, exports, individual MCP tools and live messages/delivery. See [the implemented contract](../../AUTHORIZATION.md). No resource identifiers or field filtering are supported until typed observation reads/streams replace broad RPC.

## Delivery plan

1. Land the TOML resolver and strict Python handoff (#142, merged).
2. Deliver #143 with configured password accounts or OIDC, a login page, bounded cookie sessions and shared request authorization. Verify browser cookies and WebSockets at root and a shared prefix over TLS. Runtime/Python prerequisites remain in merged #146.
3. Introduce typed observation reads/streams and retire browser DB credentials; verify restricted-role reads cannot expose payloads through another transport.
5. Add restrictive OPA decisions and equivalent resource/field enforcement across all transports.

Do not ship unsupported modes, direct database access or anonymous fallbacks as compatibility bypasses. Existing frontend-password deployments must explicitly configure accounts before upgrading.
