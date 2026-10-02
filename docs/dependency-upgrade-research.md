# Dependency upgrade research

Research date: 2026-10-02. Targets below are stable releases verified against upstream release pages and registry metadata. A version advertised on a website still needs a successful package or container download before it can be considered an executable upgrade target. The lockfiles are the complete inventory of resolved transitive packages.

## Inventory and runtime targets

| Component | Existing declaration | Latest verified stable target | Primary source |
| --- | --- | --- | --- |
| Python | `>=3.14`; Docker `3.14-slim` / `3.14-alpine`; CI `3.12` | 3.14.8 | [Python downloads](https://www.python.org/downloads/) |
| Production base | floating Python slim | `python:3.14.8-slim-trixie` | [Official image manifest](https://github.com/docker-library/official-images/blob/master/library/python) |
| Worker base | floating Python Alpine | `python:3.14.8-alpine3.24` | [Official image manifest](https://github.com/docker-library/official-images/blob/master/library/python) |
| Bun | package manager 1.3.10; Docker `1-slim` | 1.4.2 | [Bun release](https://bun.sh/blog/bun-v1.4.2) |
| uv | floating `ghcr.io/astral-sh/uv:latest` | 0.12.20 | [uv releases](https://github.com/astral-sh/uv/releases) |
| SurrealDB server | v3.0.2 | 3.3.0 | [Server releases](https://surrealdb.com/releases) |
| Python SurrealDB SDK | `>=1.0.8` | 2.0.0 | [PyPI](https://pypi.org/project/surrealdb/), [2.0 release](https://github.com/surrealdb/surrealdb.py/releases/tag/v2.0.0) |
| JavaScript SurrealDB SDK | `^2.0.2` | 2.0.9 | [SDK releases](https://github.com/surrealdb/surrealdb.js/releases) |
| Celery | application `~=5.6`; worker `>=5.4,<6`; worker lock 5.6.2 | 5.6.3 | [PyPI](https://pypi.org/project/celery/), [change history](https://docs.celeryq.dev/en/stable/changelog.html) |
| RabbitMQ test broker | floating `4-management-alpine` | 4.3.6 management Alpine | [Official image manifest](https://github.com/docker-library/official-images/blob/master/library/rabbitmq) |
| Redis test backend | floating `8-alpine` | 8.10.2 Alpine | [Official image manifest](https://github.com/docker-library/official-images/blob/master/library/redis) |

Python 3.15 remains marked prerelease by the downloads page, even though its listed planned release date has passed. Select stable 3.14.8; do not use a scheduled date as proof of release. The official Python image manifest explicitly lists the two 3.14.8 base variants above, including amd64 and arm64.

Other tool surfaces are Dockerfile frontend syntax (`docker/dockerfile:1.7`), pip installed by the base image and upgraded during build, distro apt/apk packages, Rust/Cargo native build toolchains, Docker/Compose/Buildx, `just`, pre-commit hooks, and GitHub-hosted runner images. System packages are resolved by the selected distro repositories during image builds; they have no application lockfile. Build native extensions on both deployment architectures and retain the same distro family through dependency installation and final image.

Application manifests: root `pyproject.toml`/`uv.lock`, `test_project/pyproject.toml`/`uv.lock`, and `package.json`/`bun.lock`. Hook pins live in `.pre-commit-config.yaml`; CI tools live in `.github/workflows`; image definitions live in both Dockerfiles and `test_project/docker-compose.yml`. `docker-bake.hcl` coordinates image builds. Frontend direct and development packages, and Python production/development/optional-driver packages, must each be refreshed from their package registries and then checked against the resulting locks.

## Breaking changes and review decisions

### Bun 1.4

Bun 1.4 rewrites the runtime in Rust and changes its Node compatibility baseline. It reports native-addon module ABI 147, removes `node:http`'s `writeHeader` alias, and changes unsized reads from paused streams to return one chunk. Use `writeHead` and drain reads until null where applicable. This project uses Bun as both builder and process supervisor, so check bundled runtime startup, subprocess termination, HTTP proxying, WebSockets, and filesystem/watch behavior. No large application refactor is established by these release notes alone. [Bun 1.4 announcement](https://bun.sh/blog/bun-v1.4).

The 1.4.2 patch fixes runtime regressions and crashes; prefer it over initial 1.4.0. [Bun 1.4.2](https://bun.sh/blog/bun-v1.4.2).

### SurrealDB server and SDK

The current application already targets SurrealDB 3.0, so the 2-to-3 data migration is not a new requirement of this upgrade. The 3.1 and 3.2 initial minor releases describe in-place upgrades with unchanged catalog/KV layouts. Later 3.1.6 has additive metadata changes that prevent rollback to earlier 3.1 patches. Take a backup and test a copied existing volume; do not promise rollback by replacing the binary alone. [3.1 release notes](https://surrealdb.com/releases/3.1).

3.2 enforces declared record-id types at write time, prohibits writes into computed view tables, requires permission predicates to be side-effect free, and inherits deny-by-default file access changes. The current core/demo schemas contain no typed `id` declarations or computed `AS SELECT` view tables, and their permissions are static/read-only. This is evidence that those specific changes do not require a schema rewrite; exercise actual ingestion and snapshots to verify. [3.2 release notes](https://surrealdb.com/releases/3.2).

3.3 enables GQL by default and preserves its old opt-in flag as a no-op. Audit the application's existing route/capability allowlists when updating the server. Test browser viewer authentication, ingester authentication, live-query subscriptions/reconnect, schema bootstrap, backup/replay, and persistence. [3.3 release notes](https://surrealdb.com/releases/3.3).

Python SDK 2.0 adds 3.x features, changes error handling, drops Python 3.9, and adds musl wheels. The project imports `AsyncTemplate` and `Value` through SDK modules and inspects result error shapes in `server/tasks/result_fetcher.py`; validate these imports and failed-query behavior against the installed 2.0 package. Connection retry handling also needs to catch the actual new error classes. The release is a major upgrade, but it should be kept with the ordinary update if corrections are small and verified. Extract a dedicated issue/PR only if typed error handling, transaction/result shapes, or transport changes require substantial redesign. [SDK 2.0 release](https://github.com/surrealdb/surrealdb.py/releases/tag/v2.0.0), [Python error API](https://surrealdb.com/docs/reference/python/api/errors).

### Celery parity

5.6.3 is the current published stable version; update both application and worker harness locks. The 5.6 line changes shutdown/reconnection behavior and fixes memory leaks. Its what's-new page lists Python through 3.13, so documentation alone is insufficient evidence of Python 3.14 certification. This project already requires Python 3.14: run real workers on it and distinguish application validation from an upstream support declaration. [Celery 5.6 notes](https://docs.celeryq.dev/en/stable/history/whatsnew-5.6.html).

Run the worker parity scenarios for success/failure/retry/revoke, chain/group/chord relationships, both queues, large results, broker reconnect, and worker restart. Optional Celery drivers in the `all` group are independent packages; installation and compatibility must be checked for the all-extras image as well as the regular image.

## GitHub Actions inventory

| Action | Existing ref | Latest stable release verified | Primary release source |
| --- | --- | --- | --- |
| actions/checkout | v4 | v7.0.1 | [Upstream](https://github.com/actions/checkout) |
| actions/setup-python | v5 | v7.0.0 | [Releases](https://github.com/actions/setup-python/releases) |
| astral-sh/setup-uv | v5 | v10.2.0 | [Releases](https://github.com/astral-sh/setup-uv/releases) |
| oven-sh/setup-bun | v2 | v2.2.0 | [Releases](https://github.com/oven-sh/setup-bun/releases) |
| actions/upload-artifact | v4 | v7.0.1 | [Releases](https://github.com/actions/upload-artifact/releases) |
| actions/dependency-review-action | v4 | v5.0.0 | [Releases](https://github.com/actions/dependency-review-action/releases) |
| docker/setup-buildx-action | v3 | v4.4.1 | [Releases](https://github.com/docker/setup-buildx-action/releases) |
| docker/setup-qemu-action | v3 | v4.4.0 | [Releases](https://github.com/docker/setup-qemu-action/releases) |
| docker/login-action | v3.3.0 | v4.6.0 | [Releases](https://github.com/docker/login-action/releases) |
| docker/metadata-action | v5 | v6.2.0 | [Releases](https://github.com/docker/metadata-action/releases) |
| docker/build-push-action | v6 | v7.4.0 | [Releases](https://github.com/docker/build-push-action/releases) |
| docker/bake-action | v6 | v7.4.0 | [Releases](https://github.com/docker/bake-action/releases) |
| github/codeql-action | v3 | v4.38.2 | [Releases](https://github.com/github/codeql-action/releases) |
| EnricoMi/publish-unit-test-result-action | v2 | v2.24.0 | [Releases](https://github.com/EnricoMi/publish-unit-test-result-action/releases) |
| daun/playwright-report-summary | v3 | v4.1.0 | [Releases](https://github.com/daun/playwright-report-summary/releases) |

The modern setup-python/dependency-review/setup-bun actions use Node24, requiring a recent runner; hosted `ubuntu-latest` is the repository's configured environment. Checkout v7 tightens fork checkout handling for `pull_request_target` and `workflow_run`; these workflows should not opt into unsafe checkout just to make an update pass. Checkout v6 moved persisted credentials into runner temporary storage. [Checkout](https://github.com/actions/checkout), [setup-python](https://github.com/actions/setup-python).

setup-uv v9 changes pruning defaults; v10 suppresses automatic cache saves for sensitive triggers and v10.2 for merge queues. Review caching inputs rather than assuming v5 defaults remain identical. [setup-uv releases](https://github.com/astral-sh/setup-uv/releases).

Upload-artifact v7 preserves normal archive uploads and adds optional direct single-file uploads; existing directory report uploads should keep their default archive setting. [v7 release](https://github.com/actions/upload-artifact/releases/tag/v7.0.0).

## Release evidence required

- Frozen installs succeed for Bun and both uv projects; regenerated locks are committed and optional extras resolve.
- Frontend type/lint/format/unit/build checks and Python lint/type/unit checks pass using the pinned runtime versions.
- CI runs on the supported Python version, with Bun version matching `packageManager` and the production image.
- Regular and all-extras images build on amd64/arm64; the worker harness builds with the same Python patch.
- Real Docker E2E checks prove Celery ingestion and browser live-query parity, including replay and persisted-volume upgrade.
- Upgrade documentation records tested backup/restore and actual limitations. A passing unit suite alone is not release certification.

No runtime upgrade above is proven to require a major refactor solely from the release notes. Dedicated issues should document concrete failing compatibility points found during installation/type checks/E2E, with an explicit migration target and acceptance criteria; do not defer ordinary patch updates just because the upstream version changed major number.

## Python package inventory and resolution exceptions

Versions were read from baseline commit `3e02e5d1e056f5b30f92cb511cd4a68c02000755`, the refreshed lockfiles, and public PyPI JSON metadata on 2026-10-02. Each package link points to the owning registry page. Unchanged releases are already current unless the constraint column says otherwise. This distinguishes newest published from newest compatible; overriding Celery/Kombu requirements would invalidate the supported dependency graph.

### Production direct

| Package | Baseline lock | Latest PyPI | Refreshed lock | Constraint / status |
| --- | --- | --- | --- | --- |
| [fastapi](https://pypi.org/project/fastapi/) | 0.135.1 | 0.142.2 | 0.142.2 | Current |
| [python-dotenv](https://pypi.org/project/python-dotenv/) | 1.2.2 | 1.2.4 | 1.2.4 | Current |
| [uvicorn](https://pypi.org/project/uvicorn/) | 0.41.0 | 0.54.0 | 0.54.0 | Current |
| [celery](https://pypi.org/project/celery/) | 5.6.2 | 5.6.3 | 5.6.3 | Current |
| [fastapi-cache2](https://pypi.org/project/fastapi-cache2/) | 0.2.2 | 0.2.2 | 0.2.2 | Current |
| [jinja2](https://pypi.org/project/jinja2/) | — | 3.1.6 | 3.1.6 | Current |
| [pydantic](https://pypi.org/project/pydantic/) | 2.12.5 | 2.13.5 | 2.13.5 | Current |
| [pydantic-settings](https://pypi.org/project/pydantic-settings/) | 2.13.1 | 2.15.0 | 2.15.0 | Current |
| [dans-log-formatter](https://pypi.org/project/dans-log-formatter/) | 0.2.0 | 0.2.0 | 0.2.0 | Current |
| [redis](https://pypi.org/project/redis/) | 6.4.0 | 8.1.0 | 6.4.0 | Kombu redis extra requires <6.5 |
| [surrealdb](https://pypi.org/project/surrealdb/) | 1.0.8 | 2.0.0 | 2.0.0 | Current |
| [python-multipart](https://pypi.org/project/python-multipart/) | 0.0.22 | 0.0.32 | 0.0.32 | Current |
| [prometheus-client](https://pypi.org/project/prometheus-client/) | 0.24.1 | 0.26.0 | 0.26.0 | Current |

### Development direct

| Package | Baseline lock | Latest PyPI | Refreshed lock | Constraint / status |
| --- | --- | --- | --- | --- |
| [pytest](https://pypi.org/project/pytest/) | 9.0.2 | 9.1.1 | 9.1.1 | Current |
| [pytest-xdist](https://pypi.org/project/pytest-xdist/) | 3.8.0 | 3.8.0 | 3.8.0 | Current |
| [pytest-mock](https://pypi.org/project/pytest-mock/) | 3.15.1 | 3.16.0 | 3.16.0 | Current |
| [pytest-asyncio](https://pypi.org/project/pytest-asyncio/) | 1.3.0 | 1.4.0 | 1.4.0 | Current |
| [pytest-env](https://pypi.org/project/pytest-env/) | 1.6.0 | 1.7.1 | 1.7.1 | Current |
| [pytest-cov](https://pypi.org/project/pytest-cov/) | 7.0.0 | 7.1.0 | 7.1.0 | Current |
| [polyfactory](https://pypi.org/project/polyfactory/) | 3.3.0 | 3.3.0 | 3.3.0 | Current |
| [ruff](https://pypi.org/project/ruff/) | 0.15.6 | 0.16.10 | 0.16.10 | Current |
| [ty](https://pypi.org/project/ty/) | 0.0.23 | 0.0.84 | 0.0.84 | Current |
| [ipython](https://pypi.org/project/ipython/) | 9.11.0 | 9.17.1 | 9.17.1 | Current |
| [pre-commit](https://pypi.org/project/pre-commit/) | 4.5.1 | 4.6.2 | 4.6.2 | Current |
| [httpx](https://pypi.org/project/httpx/) | 0.28.1 | 0.28.1 | 0.28.1 | Current |

### Optional-driver group and immediate extra packages

| Package | Baseline lock | Latest PyPI | Refreshed lock | Constraint / status |
| --- | --- | --- | --- | --- |
| [cryptography](https://pypi.org/project/cryptography/) | 46.0.5 | 50.0.2 | 50.0.2 | Current |
| [boto3](https://pypi.org/project/boto3/) | 1.42.68 | 1.43.107 | 1.43.107 | Current |
| [elastic-transport](https://pypi.org/project/elastic-transport/) | 9.1.0 | 9.4.2 | 9.2.1 | Celery elasticsearch extra requires <=9.2.1 |
| [elasticsearch](https://pypi.org/project/elasticsearch/) | 9.1.2 | 9.5.1 | 9.3.0 | Celery elasticsearch extra requires <=9.3.0 |
| [gevent](https://pypi.org/project/gevent/) | 25.9.1 | 26.9.0 | 26.9.0 | Current |
| [kazoo](https://pypi.org/project/kazoo/) | 2.10.0 | 2.11.0 | 2.11.0 | Current |
| [msgpack](https://pypi.org/project/msgpack/) | 1.1.2 | 1.2.3 | 1.1.2 | Kombu msgpack extra requires ==1.1.2 |
| [pyarango](https://pypi.org/project/pyarango/) | 2.1.1 | 2.1.1 | 2.1.1 | Current |
| [pycouchdb](https://pypi.org/project/pycouchdb/) | 1.16.0 | 1.17.1 | 1.16.0 | Celery couchdb extra requires ==1.16.0 |
| [python-consul2](https://pypi.org/project/python-consul2/) | 0.1.5 | 0.1.5 | 0.1.5 | Current |
| [python-memcached](https://pypi.org/project/python-memcached/) | 1.62 | 1.62 | 1.62 | Current |
| [redis](https://pypi.org/project/redis/) | 6.4.0 | 8.1.0 | 6.4.0 | Kombu redis extra requires <6.5 |
| [softlayer-messaging](https://pypi.org/project/softlayer-messaging/) | 1.0.3 | 1.0.3 | 1.0.3 | Current |
| [sqlalchemy](https://pypi.org/project/sqlalchemy/) | 2.0.48 | 2.1.2 | 2.0.54 | Kombu sqlalchemy extra requires <2.1 |
| [tblib](https://pypi.org/project/tblib/) | 3.2.2 | 3.2.2 | 3.2.2 | Current |
| [kombu](https://pypi.org/project/kombu/) | 5.6.2 | 5.6.2 | 5.6.2 | Current |

The newly explicit Jinja2 dependency was absent from the baseline lock and resolves to its latest 3.1.6. It restores the templates import required by updated FastAPI/Starlette. Build backend [hatchling](https://pypi.org/project/hatchling/) is an isolated build-system requirement, not represented in the runtime lock; the latest registry release is 1.32.4.

Celery extra declarations do not guarantee a package is installed on every Python version: `eventlet>=0.32.0` applies only on Python <3.10, and `pyro4==4.82` only on Python <3.11. Their latest registry releases are [eventlet 0.41.2](https://pypi.org/project/eventlet/) and [Pyro4 4.82](https://pypi.org/project/Pyro4/), but neither appears in this Python 3.14 lock. The baseline requested `riak`, which Celery 5.6.3 does not advertise as an extra; remove the ineffective declaration rather than claiming [riak 2.7.0](https://pypi.org/project/riak/) support from a successful install.

The worker harness direct locks changed: Celery 5.6.2 → 5.6.3, FastAPI 0.135.1 → 0.142.2, Pydantic-settings 2.13.1 → 2.15.0, and Uvicorn 0.41.0 → 0.54.0. It uses the same constrained Kombu 5.6.2 / Redis 6.4.0 graph.

### Dedicated follow-up: modern Celery/Kombu optional drivers

Open one dedicated compatibility issue for Redis-py 8.1.0, SQLAlchemy 2.1.2, msgpack 1.2.3, Elasticsearch 9.5.1 / elastic-transport 9.4.2, and pycouchdb 1.17.1. Their latest stable releases cannot coexist with current Celery/Kombu declared extras. Redis server 8.10.2 is a separate component and does not require upgrading the Python client past the upstream ceiling. [Kombu 5.6.2 Redis requirements](https://github.com/celery/kombu/blob/v5.6.2/requirements/extras/redis.txt), [Celery package metadata](https://pypi.org/pypi/celery/5.6.3/json), [Kombu package metadata](https://pypi.org/pypi/kombu/5.6.2/json).

Acceptance criteria: use released upstream requirements that permit these drivers, or develop and review a separately maintained compatibility integration; resolve a frozen all-extras environment; exercise Redis reconnect and result decoding, SQLAlchemy persistence, msgpack round trips, Elasticsearch storage, and CouchDB backend behavior. Redis-py 8 changes the default wire protocol to RESP3, so response and pub/sub behavior must be checked explicitly. Do not use dependency overrides as release evidence. [Redis-py migration behavior](https://pypi.org/project/redis/).

### Dockerfile frontend verification

Latest stable frontend is **1.27.1**, not the tentative 1.20. The upstream stable tag was published September 30 and Docker Hub metadata confirms `docker/dockerfile:1.27.1` exists. Version 1.28.0-rc1 remains prerelease. The stable 1.27.1 release limits oversized Dockerfile/dockerignore and HTTP archive reads; these repository files are far below the limit. [Stable release](https://github.com/moby/buildkit/releases/tag/dockerfile%2F1.27.1), [Docker Hub published tags](https://hub.docker.com/v2/repositories/docker/dockerfile/tags/?page_size=30).

uv 0.12.20 is independently confirmed by the upstream installer instructions and GitHub release list; it is a valid concrete pin for the copied binary. [uv installation source](https://github.com/astral-sh/uv/blob/main/docs/getting-started/installation.md), [uv releases](https://github.com/astral-sh/uv/releases).
