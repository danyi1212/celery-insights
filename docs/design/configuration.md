# TOML configuration prerequisite

Status: proposed, not implemented. Date: 2026-10-03. Prerequisite for [authentication and authorization](authentication-authorization.md); urgent security containment can proceed independently.

Tracking: [configuration #138](https://github.com/danyi1212/celery-insights/issues/138) → [authentication #139](https://github.com/danyi1212/celery-insights/issues/139) → [OPA authorization #140](https://github.com/danyi1212/celery-insights/issues/140).

## Scope and current behavior

Celery Insights currently has no structured application configuration file. `runtime/config.ts` maps 26 environment variables into Zod settings. `server/settings.py` independently reads environment variables and `.env`, with some overlapping defaults and Python-only host/port/replay settings. `bun-entry.ts` forwards selected resolved values alongside the entire inherited environment. Python logging separately reads `LOG_FORMAT` and `LOG_LEVEL`.

There are other configuration mechanisms already:

- `CONFIG_FILE` points to executable Celery `config.py`, default `/app/config.py`. If present, `server/celery_app.py` loads it instead of the environment-derived connection configuration. It is not an application config file.
- Retention changes in `/api/settings/retention` modify the current Python cleanup job in memory. They do not rewrite deployment configuration or survive restart reliably.
- Theme, welcome banner, demo selection, event display limits, explorer columns, and other UI preferences live in browser stores. `VITE_DEMO_MODE` also influences compiled frontend behavior.
- `HOST`, `PORT`, and `DEBUG_SNAPSHOT_MODE` can affect standalone Python execution; production Bun supplies an internal port and derives replay state. Generic `PORT` has different meanings depending on entrypoint.

This proposal covers every operator-configurable application setting, including advanced Celery connection options. It does not turn browser preferences, account records, runtime health/leader state, build dependency versions, operating-system variables, or E2E/tooling controls into deployment configuration. UI defaults may be deployment settings; individual preferences remain per-user data.

## Decisions

1. TOML is the sole new structured application format. Every deployment setting has a stable dotted path; only a documented subset has permanent environment overrides.
2. `CI_CONFIG_FILE` selects the application TOML file. It is distinct from legacy `CONFIG_FILE`, which selects a Python Celery module.
3. Bun alone owns the configuration module: loading, source precedence, migration aliases, secret resolution, validation, provenance, and redaction. Python receives only the resolved immutable subset needed for its work. This ownership is an explicit user decision.
4. Preserve existing env-only deployments through an announced compatibility period. Do not remove advanced settings by removing their env names: their TOML paths remain available.
5. Configuration changes require a restart initially. No file watcher, include system, implicit secret substitution, or public config-edit endpoint.

TOML fits nested typed settings, comments, and explicit tables. Adopt the TOML 1.0 subset initially and validate application types separately. It has no null value; duplicate keys are invalid. Do not invent YAML-like implicit coercions or assume a newer TOML syntax is supported by every parser. [TOML specification](https://toml.io/en/v1.0.0)

## Sources and precedence

Lowest to highest: **schema defaults → selected TOML → legacy environment aliases → permanent `CI_*` overrides → derived safety restrictions**. Safety restrictions can only narrow behavior, such as disabling ingestion in replay. They are not a configurable override source.

- File selection: explicit `--config PATH`, then `CI_CONFIG_FILE`, then `/etc/celery-insights/config.toml` if present. Reject differing explicit flag/env selections. An explicitly selected missing/unreadable file is fatal. An absent implicit file allows env-only startup; an existing malformed implicit file is fatal.
- `schema_version = 1` is required in an authored TOML file. Env-only mode uses that schema internally. Reject unknown versions and unknown keys, including misspelled `CI_*` variables; ignore unrelated platform environment variables.
- Resolve relative file paths against the selected TOML directory; environment-supplied paths against the startup working directory. Recommend absolute paths in containers. No remote config URLs, automatic `.env` search, `${VAR}` interpolation, `~` expansion, or arbitrary executable values.
- Merge scalar leaves by precedence; replace arrays atomically; maps such as OIDC group mappings are file-only. A group mapping is never implicitly extended by a second source. No generic `CI_SECTION__KEY` escape hatch.
- An explicit env override of a file leaf is normal and appears in provenance. Supplying old/new env aliases for the same leaf with unequal normalized values is an error, not a silently chosen winner; equal values are accepted with an alias warning.
- New TOML/new env values require strict types. Booleans from env accept only documented `true`, `false`, `1`, `0`; reject empty and unrecognized values. Validate finite numbers, bounds, URLs, identifiers, timezones, and cross-field invariants after merging. Do not print offending secret values in validation errors.
- Omission means default; explicit disable flags turn optional features off. Retention limit subtables use `enabled` plus numeric `value`, so default-on worker retention can be disabled without null or sentinel strings. Enabled limits require positive finite values. Keep unit suffixes in key names; no duration-string grammar initially.

## Existing setting migration catalog

This table covers all 26 current Bun environment mappings. Defaults listed here describe current behavior, not a promise to retain insecure defaults. “File” means the old env remains a compatibility alias before retirement.

| Current env | Current default | Canonical TOML path | Permanent override / disposition |
| --- | --- | --- | --- |
| `PORT` | 8555 | `server.port` | `CI_PORT` |
| `SURREALDB_URL` | `ws://localhost:8557/rpc` | `database.observation.url` | `CI_DATABASE_URL`; unify with external URL |
| `SURREALDB_EXTERNAL_URL` | unset | `database.observation.mode` + `.url` | External mode inferred from `CI_DATABASE_URL` if mode omitted |
| `SURREALDB_INGESTER_PASS` | `changeme` | `database.observation.ingester_password` | `CI_DATABASE_INGESTER_PASSWORD`, `_FILE`; remove default with security migration |
| `SURREALDB_FRONTEND_PASS` | unset | `migration.legacy_frontend_password` | Migration-only alias; removed with direct browser DB auth |
| `SURREALDB_NAMESPACE` | `celery_insights` | `database.observation.namespace` | File |
| `SURREALDB_DATABASE` | `main` | `database.observation.database` | File |
| `SURREALDB_STORAGE` | `memory` | `database.observation.embedded.storage` | `CI_DATABASE_STORAGE` |
| `SURREALDB_PORT` | 8557 | `database.observation.embedded.port` | File |
| `INGESTION_ENABLED` | true | `ingestion.enabled` | `CI_INGESTION_ENABLED` |
| `INGESTION_LEADER_ELECTION` | true | `ingestion.leader_election.enabled` | File |
| `INGESTION_LOCK_TTL_SECONDS` | 30 | `ingestion.leader_election.ttl_seconds` | File |
| `INGESTION_LOCK_HEARTBEAT_SECONDS` | 10 | `ingestion.leader_election.heartbeat_seconds` | File |
| `CLEANUP_INTERVAL_SECONDS` | 60 | `retention.cleanup_interval_seconds` | File |
| `TASK_MAX_COUNT` | unset | `retention.tasks.max_count.value` + `.enabled` | File; legacy supplied value enables limit |
| `TASK_RETENTION_HOURS` | unset | `retention.tasks.max_age_hours.value` + `.enabled` | File; legacy supplied value enables limit |
| `DEAD_WORKER_RETENTION_HOURS` | 24 | `retention.workers.max_age_hours.value` + `.enabled` | File; default enabled with value 24 |
| `INGESTION_BATCH_INTERVAL_MS` | 100 | `ingestion.batch_interval_ms` | File |
| `BROKER_URL` | development AMQP URL | `celery.broker_url` | `CI_BROKER_URL`, `_FILE` |
| `RESULT_BACKEND` | development Redis URL | `celery.result_backend` | `CI_RESULT_BACKEND`, `_FILE` |
| `CONFIG_FILE` | `/app/config.py` | `celery.legacy_python_config_file` | Legacy compatibility only; explicit trusted-code escape hatch |
| `DEBUG_BUNDLE_PATH` | unset | `diagnostics.replay_bundle_file` | `CI_REPLAY_BUNDLE_FILE` |
| `TIMEZONE` | UTC | `celery.timezone` | File |
| `DEBUG` | false | `server.debug` | File; disallowed by production auth profile |
| `LOG_FORMAT` | pretty | `logging.format` | `CI_LOG_FORMAT` |
| `LOG_LEVEL` | info | `logging.level` | `CI_LOG_LEVEL` |

Additional settings and distinctions:

| Current source | Canonical disposition |
| --- | --- |
| Python `host` / standalone `HOST` (0.0.0.0) | `server.api.host`; production default loopback behind Bun, explicitly set in supported split deployments |
| Python port 8556 / Bun internal constant | `server.api.port`; public port is always `server.port`; translate standalone old `PORT` according to legacy entrypoint and warn |
| Python `debug_snapshot_mode` / `DEBUG_SNAPSHOT_MODE` | Derived from `diagnostics.replay_bundle_file`; no user-settable TOML key or new env |
| Python `.env` | Explicit development-only launcher input, translated through the same module; no independent production Python loading |
| Python logging `LOG_FORMAT` / `LOG_LEVEL` | Same resolved logging snapshot as Bun; no import-time env read |
| `VITE_DEMO_MODE` / browser demo preference | Retire production build toggle in favor of file-only `ui.demo_available`; isolated demo adapter only, never changes server authorization |
| Theme/banner/raw events defaults | `ui.defaults.theme`, `.hide_welcome_banner`, `.raw_events_limit`; browser overrides are separate per-user state |
| Explorer column/filter/layout preferences | Per-user data; no operator setting unless an explicit supported default is added to the registry |
| Retention UI changes | Transitional temporary runtime override; ownership rules below |

Database topology becomes `mode = "embedded" | "external"`. If no mode is provided, an explicit URL selects external; otherwise embedded. Explicit embedded mode plus an external URL is invalid. Embedded connection URL derives from embedded bind/port, so callers no longer coordinate two URL fields. During migration, preserve the old URL/external-URL inference exactly when only old variables are present; emit a targeted warning for unusual combinations, and require explicit canonical configuration before ending compatibility. Replay rejects explicit external topology in the new schema rather than silently redirecting it; the old replay behavior remains only in the compatibility adapter with a warning.

`migration.legacy_frontend_password` is a temporary import setting, not a permanent second login system. Document its removal in the auth release. Root/provisioning, reader/writer, and control-store credentials introduced by that release each receive separately scoped secret paths; never preserve `root/root` or `changeme` as new-schema production defaults. URL credentials count as secrets too.

## Permanent environment surface

Keep permanent overrides focused on container wiring: `CI_CONFIG_FILE`, `CI_PORT`, `CI_DATABASE_URL`, `CI_DATABASE_STORAGE`, `CI_INGESTION_ENABLED`, `CI_BROKER_URL`, `CI_RESULT_BACKEND`, `CI_REPLAY_BUNDLE_FILE`, `CI_LOG_FORMAT`, `CI_LOG_LEVEL`, and `CI_PUBLIC_URL` (`installation.public_url`). Advanced tuning, role/group maps, and OPA contracts are file-only.

Additionally, allow registered secret value/file pairs: database credentials, `CI_BOOTSTRAP_PASSWORD` / `_FILE` (as already agreed), `CI_OIDC_CLIENT_SECRET` / `_FILE`, and control-store credentials. Secret pairs are explicit registry entries, not an automatically generated env name for every key. URLs containing credentials support `_FILE` too. New secrets must declare both TOML paths and allowed override names. Simple local env-only installs remain possible; complex SSO/OPA installations use TOML.

Authentication paths retain the vocabulary in the auth plan: `authentication.mode`, `authentication.bootstrap.*`, `authentication.local.*`, `authentication.oidc.*`, `authorization.provider`, `authorization.opa.*`, and `installation.public_url`. Persistent identity connectivity uses `database.control.*`. Before implementation, register every field described in the auth plan, including session lifetimes, MFA/assurance rules, proxy trust, OPA transport/freshness/revision, and service-token controls. Publishing a new knob without a canonical path is prohibited. Accounts, sessions, grants and active policy rollout records themselves remain control-store data, not configuration secrets pasted into TOML.

## Secret resolution

For every registered secret `x`, support `x` (direct value) or `x_file` (file path). Group them as one source-selection unit across precedence: an explicitly configured source at a higher layer replaces the lower-layer source, including a file-to-env override. If the resulting winning layer supplies both forms, reject. For environment aliases, differing old/new aliases are errors. This preserves useful overrides without silently accepting ambiguous credentials.

At the environment layer, `CI_BOOTSTRAP_PASSWORD` and `CI_BOOTSTRAP_PASSWORD_FILE` are mutually exclusive. A TOML file reference overridden by a single environment password is allowed and recorded as an override; the lower file is not read. Empty winning values or unreadable winning files fail startup without fallback. Thus the earlier “both supplied” rule means two competing forms in the winning layer, not a lower-priority file reference plus a legitimate override.

Read bounded UTF-8 secret content once at startup; remove at most one terminal LF or CRLF, preserving all other whitespace. Document this convention and reject NUL/oversize/empty credentials. TLS certificate/key paths are file paths read by their owning transport library, not password contents to be copied into JSON. Never disclose secret values in CLI output, logs, exceptions, source diagnostics, URLs, or downloadable bundles. Custom Celery options are conservatively sensitive unless explicitly classified safe.

Secret mounts may be updated by the platform, but the application snapshot is immutable until restart. Bootstrap remains one-time after restart as well. Dynamic secret rotation is deferred until its reconnect/revocation semantics are separately designed. Restrict read permissions and mount only into processes that require the secret.

## Celery configuration without executable Python

Expose typed `celery.broker_url`, `result_backend`, `timezone`, broker/backend transport options, and TLS options. Represent nested data-only Celery settings under `celery.options`; validate supported names against the pinned Celery release and reject reserved keys owned by the canonical connection fields. Permit mappings/lists/primitive values, not imports, dotted callable resolution, serialized objects, or evaluated strings.

For example, Sentinel configuration and Redis TLS parameters must be translated using the actual transport's documented semantics, not a universal broker abstraction. Celery supports options that require Python objects; TOML cannot represent every executable Celery configuration. Keep `celery.legacy_python_config_file` as an explicitly enabled trusted-operator escape hatch during migration rather than claiming complete equivalence. [Celery configuration reference](https://docs.celeryq.dev/en/stable/userguide/configuration.html)

Legacy Python module mode must not coexist with new connection/options settings or their env overrides. In compatibility-only startup, preserve the existing module precedence with a warning. In canonical startup, reject ambiguous combinations. Stop implicitly executing `/app/config.py` in new mode; require an explicit path. A missing explicitly configured module is fatal. Auth/security settings can never be loaded from the Celery module.

Insights-owned monitoring queue requirements are derived operational settings; document whether incompatible custom options are rejected or normalized. Do not silently modify an arbitrary Celery option while claiming it is the effective configuration. Raw Python modules are never copied into downloadable diagnostics.

## Resolver module and process handoff

Proposed interface:

```text
resolveConfig({argv, env, files}) -> {snapshot, provenance, warnings}
describeConfig(snapshot, provenance) -> redacted description
```

Accept file/environment dependencies rather than reading globals at module import. A schema registry owns paths, types/defaults, secrecy, accepted env names, aliases, restart behavior, and documentation metadata. Generate reference docs and normalized JSON schema/types from that registry; avoid maintaining two independent loaders in Zod and Pydantic.

Bun resolves once before spawning databases/Python or binding public listeners. Feed each Python child a versioned, validated subset over a dedicated inherited pipe/file descriptor, not JSON in argv, a world-readable temp file, or dozens of secret environment variables. Python checks transport version/shape as a typed object, but does not implement configuration parsing, precedence, defaulting, secret-file reads, or policy validation. It never reloads TOML, `.env`, or inherited application overrides. Failed/mismatched handoff is fatal. Pass only needed settings and a minimal documented process environment; do not inherit all secrets into every subprocess.

Define separate child projections: the API receives API bind settings, query/control-store credentials and the authentication/authorization settings it enforces; the ingestion worker receives Celery connectivity, ingestion/retention settings and observation-write credentials. In the current combined Python process, send their needed union until the planned split lands. Static serving and supervisor-only settings stay in Bun. No Python projection contains provisioning/root credentials, Bun-only embedded storage/supervisor settings, or unrelated credentials. Python may consume TLS file paths required by its transport libraries; that is runtime resource access, not a second secret/config resolver.

Update `dev:server` to use the same resolver-backed launcher for Python-only development. Direct `python run.py` becomes an internal entrypoint requiring a snapshot; document the change. Logger construction, Celery initialization, diagnostics, and Settings consumers use the supplied immutable object. Remove module-import-time configuration singleton side effects and fallback `Settings()` calls that re-read environment state.

The CLI provides `config validate`, `config show` (always redacted with provenance), `config example`, and `config migrate-env`. These commands resolve/validate without starting Celery, connecting databases, or binding ports. There is no unsafe `show --include-secrets`. `migrate-env` uses the explicit alias allowlist, does not dump unrelated environment variables, redacts secrets by default and emits secret reference placeholders plus actionable warnings. It never executes/imports a legacy Python module to migrate it.

## Example customer configuration

All examples are proposed schema, not currently accepted by the application:

```toml
schema_version = 1

[server]
port = 8555

[celery]
broker_url_file = "/run/secrets/insights/broker-url"
result_backend_file = "/run/secrets/insights/result-backend"
timezone = "UTC"

[database.observation]
mode = "external"
url = "wss://surreal.example.internal/rpc"
namespace = "celery_insights"
database = "main"
ingester_password_file = "/run/secrets/insights/ingester-password"

[ingestion.leader_election]
enabled = true
ttl_seconds = 30
heartbeat_seconds = 10

[retention.tasks.max_age_hours]
enabled = true
value = 48

[retention.workers.max_age_hours]
enabled = false

[logging]
format = "json"
level = "info"

# Available when the authentication prerequisite's follow-on work lands:
[authentication]
mode = "local"

[authentication.bootstrap]
enabled = true
admin_username = "admin"
password_file = "/run/secrets/insights/admin-password"
```

In Kubernetes, mount nonsecret TOML from a ConfigMap and sensitive values from Secrets; set `CI_CONFIG_FILE` to the mounted TOML. Alternatively inject selected values using `secretKeyRef`. The ConfigMap must not contain literal passwords. Compose/VM deployments mount the same TOML and secret files; no Kubernetes dependency exists in the loader. Files/secrets must reach every replica; rollout restarts apply changes. Do not share a local embedded observation disk across replicas as an HA strategy.

## Ownership and changing settings

Operator configuration owns deployment settings. The UI exposes effective settings and provenance; it does not write the mounted TOML or modify pod environment.

Preserve today's retention UI adjustment temporarily, but explicitly label it a process-local, nonpersistent override that disappears at restart/leader change. It is not merged into the canonical startup snapshot or reported as deployment configuration. Apply authorization to it immediately in the auth work.

Target behavior removes temporary retention editing and presents deployment-owned retention read-only, with guidance to edit TOML and roll out. If persistent UI editing is required later, add an explicit `retention.source = "deployment" | "managed"` ownership mode and a durable versioned policy in the control store. That requires shared leader coordination/audit and is not a hidden third source in this prerequisite. A UI must never claim a temporary edit is durable or cluster-wide.

No hot reload initially. Distinguish startup config, derived state (leader, replay, policy loaded revision), transitional runtime overrides, and user preferences in diagnostics. A redacted config fingerprint includes nonsecret resolved settings/schema version, not secret content or low-entropy secret hashes. Cross-replica drift can be reported, but intentionally different ingestion roles or ports are allowed; compare only installation-wide fields.

## Migration and rollout

1. Establish the complete schema registry, current-default/precedence fixtures, and generated migration/reference catalog before changing behavior. Inventory deployment docs, Compose/E2E, debug snapshots, standalone Python, frontend build toggles, and logging consumers.
2. Implement the resolver and TOML loader, CLI commands, redaction, env compatibility adapter, secret value/file sources, and process snapshot handoff. Keep current safe behavior stable; security-default changes get explicit release notes.
3. Switch all Bun/Python consumers to the snapshot and update development launchers. No independent `.env`/logging loader remains. Verify existing env-only fixtures and advanced Celery module deployments.
4. Publish ConfigMap/Secret, Compose, VM, durable single-node, HA, and replay examples. Update diagnostics to export a safe resolved description, not raw config/TOML/secret/Python files. Generated samples describe actually shipped features only.
5. Land auth configuration on this registry and convert the auth plan's examples to TOML. Authentication and OPA have no parallel YAML loader. Urgent vulnerability fixes do not wait for the entire configuration migration.
6. Keep all old deployment env aliases for at least one announced release cycle; warn with old name → TOML path/new env, never values. Decide removal version through release policy before shipping. Remove advanced old env aliases only after conversion docs/tools ship. Old insecure auth/database paths retire on the explicit security migration schedule and do not become compatibility bypasses.

Do not treat adopting TOML as permission to remove connection support, change retention silently, run insecure production defaults, or load bundled configuration during replay. Replay restores observation data, never deployment auth/config/secrets. Unknown obsolete settings produce actionable errors after the removal release rather than being ignored.

## Required verification

- Coverage: every current application setting above maps to a registry path or explicit derived/migration-only disposition. No unregistered direct environment reads remain in application code; tooling/test-project controls are separately scoped.
- Precedence: defaults/file/aliases/new env; normal overrides; mismatching aliases; unknown keys; missing explicit file; malformed TOML; relative paths; no implicit interpolation; arrays/maps; disabled retention with no null values.
- Secrets: file/value overrides in both directions, same-layer conflicts, empty/unreadable/oversize content, single-newline convention, no fallback, and redaction across startup logs, URL errors, CLI, Python exceptions, and bundles.
- Cross-process: Bun and Python consume equivalent values, logging included; inherited stale env/.env cannot change the snapshot; missing/schema-mismatched handoff fails; development launchers share the interface.
- Compatibility: old env-only fixtures, external-URL heuristics, legacy Python module precedence, replay restrictions, standalone ports, and documented security migrations. No runtime account reset on secret/config restart.
- Deployment: parse all example TOML and validate shipped examples against the registry; test ConfigMap plus Secret env/file injection, Compose mounts, VM relative paths, and multiple replicas. Never require an external connection for `config validate`.
- Ownership: retention UI labels/permissions, immutable startup snapshot, per-user preference persistence, config fingerprint drift reporting, and restart requirements.

Completion gate: the current-setting catalog, one resolver/process handoff, compatible startup, safe secret delivery/redaction, generated examples, and deployment tests must pass before auth implementation introduces its settings.
