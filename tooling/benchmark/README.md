# Benchmark tool (in development)

Measurements require **Bun >=1.4.2** (the project pins 1.4.2), Docker and OpenSSL. The controller records its actual version. A repeated local HTTPS asset failure on Bun 1.3.10 disappeared with the same fixture on 1.4.2; older measurement controllers are rejected before setup. Comparison/history commands can still read retained historical reports.

This first slice exercises real RabbitMQ delivery, the normal production ingestion loops,
Redis result fetching/polling, workflow writes, authorized typed reads, and public refresh-driven convergence.
Optional Chromium journeys measure Explorer's first useful rows and navigation to task details.
They also validate search/reset and the rendered task result, collect laboratory paint/interaction
metrics, and record fetched asset bytes. `--api` adds fixed-arrival HTTP/MCP contract workloads;
`--artifacts` inventories raw/gzip/Brotli production build sizes after timed work.

Use a current source-built image, not an unrelated local image:

```shell
docker build -t celery-insights-benchmark:local .
bun run bench --tasks 256 --rate 100 --browser
bun run bench --tasks 256 --rate 500
bun run bench --tasks 128 --rate 100 --result-bytes 102400
bun run bench --tasks 128 --rate 100 --api --request-count 600 --request-rate 200 --browser --artifacts
bun run bench --tasks 32 --rate 100 --browser --browser-profile constrained
bun run bench --tasks 32 --rate 100 --history-tasks 10000 --queries --api --browser
BENCH_STORAGE=surrealkv:///data/store bun run bench --tasks 32 --rate 100 --history-tasks 100000 --queries
```

Each run creates an isolated Compose project, private broker/backend, fresh RocksDB volume,
and ephemeral localhost port. It writes JSON, producer output, app logs, resource samples,
and cleanup evidence under `test-results/benchmark/<run-id>/`. It removes its own containers
and volume afterward. The generator runs in a separate container. Other existing stacks are untouched.

The output records image ID/platform, source SHA and dirty status, app CPU/memory limits,
raw timing samples/counts, scheduling lag, correctness problems, browser errors, and flush failures.
Harness files are hashed and the local Bun/browser versions recorded. Request/browser/resource
phases have separate observations; the top-level result preserves any earlier scenario failure.
The default app allocation is **an exploratory test point** of 2 CPU / 2 GiB, not a resource recommendation.
Override `BENCH_CPU`, `BENCH_MEMORY`, `BENCH_STORAGE`, and `BENCH_INDEXING` for named experiments.
Do not compare different configurations as equivalent baselines.

Check that final-state correctness cannot hide incomplete history:

```shell
bun run bench --tasks 32 --rate 100 --drop-sequence 0
```

That injected-omission run must exit nonzero and report incorrect raw-event coverage.
Pure validator tests can run with `python -m pytest tooling/benchmark/pipeline_test.py`.
Measurement-contract tests run with `bun run test tooling/benchmark/metrics.test.ts` and are part
of the normal frontend test suite.

`--api-extended` adds MCP discovery and independently validated first/continuation history pages to
the post-ingestion mix. Each scheduled operation still makes one HTTP request; the continuation
cursor is established during validated warmup against frozen task history.

API warmup checks each response contract before timed repetition. The deterministic mix currently
covers HTTP config, settings info, Prometheus metrics, MCP task overview/history, and workflow overview.
Requests have a ten-second timeout and at most 32 in flight; dropped requests make the measurement
inconclusive. Override and record the cap with `--request-concurrency`; it is part of the workload.
The default is 120 requests at 40 offered requests/s, an exploratory calibration point.
Per-case successful latency and all-attempt scheduled-completion distributions remain distinct.

Browser profiles use fresh contexts at 1440 × 900. `desktop` is unthrottled; `constrained` configures
Chromium's network emulation (1.6 Mb/s download, 750 kb/s upload, 150 ms latency) and 4× CPU slowdown.
These are lab configurations rather than a claim about a particular physical device or actual RTT.
Useful-data milestones wait for painted fixture content, not network idle. LCP is sampled before
interaction at Explorer readiness; task navigation has a separate expected-result milestone.
Search journeys measure rapid typing (10 ms/character), reset, and pasting a distinct absent term.
Pasting uses an uncached query key; fixed ordering and warm database caches are recorded limitations.
CDP data-frame counts/bytes are attributed by observation phase. Outgoing RPCs are decoded after
timing to distinguish Explorer requests from background traffic; cross-phase replies remain
attributed to their arrival phase rather than assumed to belong to the current action.

`--history-tasks` seeds retained tasks directly into the production schema before ingestion.
Each historical task has four raw events and workflow membership in groups of up to four, with
10% failures, eight worker names, four types, and organization IDs modulo eleven. Timestamps sit
10–40 minutes before the run's reference time. `--history-payload-bytes` controls successful result
padding (default 256 bytes). This setup measures read/storage scale, not historical ingestion;
historical raw event data is a restricted synthetic payload, and Redis history keys are not seeded.
Setup has an explicit `--seed-timeout-seconds` deadline (default 600 seconds), recorded in the
scenario. Failure to complete setup produces an incomplete result with command diagnostics and
cleanup evidence; it does not establish an ingestion-capacity limit. Workload timing excludes setup.

`--api-during-ingestion` starts fixed-arrival HTTP/MCP traffic alongside the producer. It requires
at least four historical tasks, checks stable task identity/state/result during writes and validates
changing counts against fixture bounds. Observed task-count growth witnesses write overlap; absent
progress makes the scenario inconclusive. Full final data correctness remains the separate pipeline
oracle. `--request-count`, `--request-rate` and `--request-concurrency` control this workload too.
It can be combined with `--api` for a distinct post-ingestion control.

## Comparing runs

```shell
bun run bench compare --baseline path/to/baseline/result.json --candidate path/to/candidate/result.json --output test-results/benchmark/comparison
```

The command writes `comparison.json` and `comparison.md`. It compares schema-3 runs with matching
workload, fixture, harness file hashes, actual storage/indexing settings, resource limits, runner
class/hardware, Docker environment, broker/backend image identities, and browser profile/version
when applicable. Run-relative history timestamps are excluded from equality. Application image,
source, shared application query implementation, and dependency-lock changes remain attribution;
they do not prevent detecting application changes. Older/incomplete metadata is explicitly rejected.

Use `--runner-class` for a named controlled environment; the default is the local hostname.
Hardware/runtime settings must still match. A shared class label does not prove uncontended hosted
hardware or equivalent storage. Tight timing gates and sizing still require controlled confirmation.

Correctness failures and unhealthy generators are visible outcomes, never faster passing baselines.
Unavailable percentiles remain unavailable. Reports include sample counts, units/directions, absolute
and relative deltas, and thresholds. A comparison of the same image is labeled calibration rather
than an application-change comparison. Few browser repetitions and query samples do not establish
field vitals, p95 navigation, or sustainable capacity.

Default flags are **report-only**: degradation exceeding the larger of 15% and a provisional unit
floor (5 ms, 0.05 s, 1 KiB, 0.05 CPU-seconds, 1 request/s, or 0.01 CLS score). These are calibration
candidates, not noise floors, product SLOs, or validated regression gates. Override with `--budgets`
and a JSON object matching the `budgets` field in a comparison report. Every unit floor is required.
Confirm suspects with controlled alternating baseline/candidate repetitions and retain every attempt.

The comparison exits 0 for a report-only result even when timing flags exist, 1 for a failed/incomplete/inconclusive candidate,
and 2 for an unusable baseline/incompatible series. Reports are written for these outcomes. Invalid
arguments/budget files fail before reporting. Run and comparison output directories must be new;
existing artifacts are never overwritten. Publishing must keep nonzero/incomplete outcomes visible.

`--queries` sends the production typed Explorer request to the authorized observation API: rows,
counts, facets, and histograms together. It validates paginated fixture IDs, state totals, selected
rows, and aggregate counts outside timing. One validated warmup precedes `--query-repetitions`
(default three) sequential samples per case. Report median/range, not query throughput or p99.
Query plans are unavailable through this API. Private relation record IDs are checked by the history
seed oracle; public maintenance/replay checks validate task membership and workflow summaries.

Every run configures a synthetic administrator account and explicit database passwords in its
private fixture. The browser signs in through a local Bun HTTPS relay with a generated certificate;
programmatic API/SDK clients use explicit Basic authentication and the configured origin over the
internal HTTP/WebSocket path. TLS relay cost belongs to the controller, outside app quotas. Browser
measurements include that relay; public read/API measurements include application authentication.
These transport and authorization profiles are not interchangeable with production OPA/OIDC or
remote ingress profiles. No database credentials or arbitrary SQL travel through the public API.

## Current measurement limits

`--reader-mode shared` (default) paces typed task-list requests on the public refresh observer's
connection. `separate` uses another public connection; `none` removes background list traffic.
Public subscriptions send refresh markers every five seconds, then clients refetch authorized
records in a timestamp window with a one-second overlap. An unconditional full snapshot after
publication and the committed-count witness must reconcile every event/result, including late or
older timestamps; the oracle still rejects missing/duplicated history. This bounds repeated reads
during long runs without assuming timestamp order. `pipeline.public_refresh` reports publication-to-raw-event and terminal-to-result freshness
including that cadence. Completeness is required alongside the independent persisted-data oracle.
Additional clients exercise the same public refresh/refetch contract. Slow delay paces refetching;
it does not simulate a bandwidth-constrained network or prove reconnect recovery.

Unprefixed `publication_to_raw_event_live_ms` and `terminal_to_result_live_ms` retain separate private
native database notification diagnostics. They are not public freshness measurements. The oracle
runs outside the app cgroup and shares only its network namespace, using the private database port.
The measurement contract and harness hashes start a new comparison series after this migration;
earlier proxy-based reports remain historical evidence.

`BENCH_NOTIFICATION_BUFFER=1024` changes SurrealDB's per-connection response/notification channel
size for a diagnostic run (default 100). The selected native environment value is recorded and
comparisons across channel sizes are rejected. Larger bounded queues can absorb bursts, but cost
memory per connection and do not establish sustained delivery, slow-client recovery or reliable
browser convergence. The default mixed scenario must still be tested.

Use `--image <reference>` to reuse a production build, preferably an immutable registry digest.
`--pull` records image-fetch duration and whether the image was already locally available.
`--expected-source-sha <full-sha>` requires a clean checkout at that SHA and a matching
`org.opencontainers.image.revision` image label. A local development image without that label
can be measured without this provenance guard, but is unsuitable as an exact CI build reference.
Image fetch duration is not native pod cold-start latency.

- Resource guidance is bounded to measured workloads; see [the sizing example](../../docs/benchmark-resources.md).
- The public typed reader is paced every 100 ms. Its latency is observed under ingestion; its rate is not query capacity.
- Publication-to-raw-event-LIVE and terminal-to-result-LIVE use one generator/observer monotonic clock.
  Result polling can supply terminal state before ingestion drains; they are separate metrics.
- Persisted correctness uses a separate private database connection. Public refresh delivery must
  complete, while retained-history correctness is checked after bounded drain. Partial successful
  delivery samples cannot establish tail latency for that failed run.
- The provisional 100 ms maximum publisher-lag rule marks timing results inconclusive when the generator falls behind.
- Raw samples are retained for the small workload; larger-scale suites will need bounded distributions.
- Browser timings represent one fixed-profile laboratory journey after writes stop. Raw Performance
  Observer/Resource Timing entries are retained; unsupported metrics are unavailable, not zero.
  Laboratory interaction duration is not field INP. `--browser-live` separately validates rendering during publication.
- API measurements run after ingestion on the small fixture. Many workers and sustained API capacity still need named scenarios; `--api-extended` covers discovery and task-history pagination.
  `--api-during-ingestion` supplies a separate write-overlap workload; `--maintenance` covers backup export.
- Artifact compression is computed with gzip level 9 / Brotli quality 5. It is not evidence that
  HTTP serving applies compression. Whole dist bytes include lazy/demo chunks never fetched by this journey.
- HTTP-ready timing includes Compose/dependency startup and probe observation; it is not pod startup or ingestion readiness.
- The legacy `du` observation is allocated KiB while running. History profiles add byte-accurate
  allocation/logical-file snapshots and an orderly-shutdown observation; compaction and retention
  cycles are measured by `--maintenance`; they do not prove engine compaction. Do not extrapolate one fixture into a universal bytes/task quote.
- Docker resource samples use Docker's reported memory/CPU semantics and label phase boundaries.
  Native cgroup v2 snapshots additionally bracket pipeline-container-run, API (including warmup),
  and browser phases: CPU seconds/cores, quota/throttling counters, memory current/cumulative peak,
  inactive-file bytes, memory events, I/O counters, and Bun/Python/SurrealDB CPU/RSS. Unsupported
  counters are unavailable, not zero. Brackets include collector/container-exec overhead; cumulative
  peaks include startup, and per-process RSS must not be added into container working set.
  Throttled-time counters can aggregate across threads/cores and exceed phase wall time; do not
  interpret their ratio as a wall-clock percentage. Optional continuous sampling reports steady
  CPU and memory slopes. Producer/observer process CPU, peak RSS and container limits/peak are recorded separately; instrumentation-overhead calibration remains open.
- Comparison provides compatible single-run report-only deltas. Empirical noise calibration and reviewed release
  reference selection are available; broader scale/storage/topology sweeps remain open. Cached restart, bounded soak
  and native pod cases are available; the full scope remains in `docs/design/benchmarking.md`.

Execution contract 1 requires a finalized successful private-container cleanup before a result can
serve as a comparison reference. Earlier reports and interrupted checkpoints remain evidence but
cannot enter this comparison series. Controller costs include setup, collection and cleanup separately
from workload timing.

### Leader failover

```shell
bun run bench failover --image <image> --arrival-mode after-takeover --output <new-directory>
bun run bench failover --image <image> --arrival-mode during-failure --output <new-directory>
```

These isolated Compose cases use two app instances sharing a separate native RocksDB server.
The harness kills the leader, measures standby election, checks a persisted sentinel, and runs
independent raw-event/task/workflow/result and production-browser oracles. Paused arrivals and arrivals
continuing through failure are distinct cases. A restored result does not prove complete event history.
Reports retain failures and cleanup evidence. This does not measure database crash recovery or
multi-node storage, and these schema-1 reports are separate from the main regression-history series.

`--maintenance` requires retained history. It exports the production backup, validates task/raw-event
identities and workflow membership, then runs two count-based cleanup and backup/import cycles.
Each cycle validates retained and restored data and captures allocated/logical storage. Pollers stay
active, but new events are not published during maintenance. The raw exported backup is retained as
`maintenance-backup.json`; this synthetic artifact can be large. Cleanup does not prove compaction.
Enabled-index history fixtures populate production search projections before query validation.

For native pod startup cases, install Docker, kubectl and kind, then run:

```shell
bun run bench pods --image <locally-present-image> --output <new-directory>
```

`--kind <executable>` selects a kind binary. The command creates and deletes its own single-node
cluster, uses a private kubeconfig and measures scheduled, container-started and real-query-ready
milestones. An empty-store pod ingests real broker events; a replacement pod validates preserved
data, followed by a production-browser journey. Images are cached by default. `--image-cache registry-cold` pushes only the selected native
image into a disposable local registry, checks the fresh node image/layer inventory, and measures
its first pull/unpack followed by a cached retained-store replacement. This measures a local
registry path; it does not establish cloud/Internet pull latency. Cold mode also requires Crane
(`--crane <executable>` selects it). Upload uses a native image archive from the host, so it does
not require changing Docker daemon registry settings. The registry, node and temporary archive
are cleaned up. Cluster setup and native-platform image import are separate costs. Reports, manifests, logs
and events remain in the output directory, including incomplete attempts. These deployment reports
are separate from schema-3 regression comparisons. Cloud storage/topologies remain separate cases.

## Main-build measurement and publication

Selected manual suites keep expensive discovery out of the automatic core:

```shell
bun run bench suite --manifest tooling/benchmark/suites/core.json --image <image> --output <new-directory>
bun run bench suite --manifest tooling/benchmark/suites/throughput.json --image <image> --output <new-directory>
bun run bench suite --manifest tooling/benchmark/suites/calibration.json --image <image> --output <new-directory>
bun run bench suite --manifest tooling/benchmark/suites/scale.json --image <image> --output <new-directory>
bun run bench suite --manifest tooling/benchmark/suites/resources.json --image <image> --output <new-directory>
bun run bench suite --manifest tooling/benchmark/suites/soak.json --image <image> --output <new-directory>
bun run bench suite --manifest tooling/benchmark/suites/mixed.json --image <image> --output <new-directory>
bun run bench suite --manifest tooling/benchmark/suites/maintenance.json --image <image> --output <new-directory>
bun run bench suite --manifest tooling/benchmark/suites/fanout.json --image <image> --output <new-directory>
```

Each scenario gets fresh private storage; images/dependencies can remain cached. Scenarios run
sequentially, with explicit CPU/memory/storage/indexing settings and immutable output directories.
`suite.json` is checkpointed after every attempt and records setup/workload/reporting elapsed cost.
Failures do not erase later attempts or turn the suite green. Presets are exploratory test points,
not resource recommendations; the 15-minute soak validates a bounded workload, not indefinite growth.

`--live-clients 5` adds independently authenticated raw-event subscribers, up to 16 total clients.
Every client must observe all expected events before bounded drain ends. `--slow-client-delay-ms 100`
paces the last additional subscriber's iterator consumption; SDK/socket buffers may still read ahead,
so this is a paced-consumer case rather than proof of network backpressure. Each subscriber has its
own latency/count evidence. Protocol subscribers share the generator process and do not replace
browser rendering measurements.

`--burst-rate`, `--burst-seconds` and `--burst-at-seconds` declare a fixed-arrival burst followed by
steady-rate recovery. The workload must include the complete burst and a recovery period.
`--resource-interval-seconds 10` collects native cgroup/process samples; steady trends exclude the
initial 30 seconds. Growth during added retention is distinguished from a leak. `--restart` validates
all retained benchmark events/results after an orderly cached-image Compose restart.

Calibrate existing compatible runs with:

```shell
bun run bench calibrate --output <new-directory> <result-1.json> <result-2.json> <result-3.json> <result-4.json> <result-5.json>
bun run bench compare --baseline <baseline.json> --candidate <candidate.json> --budgets <new-directory>/budgets.json
```

Calibration requires five distinct valid runs of the same image/series. It records empirical ranges,
not confidence bounds. Generated noise budgets record their comparison series and trial identities. They are rejected
when the runner, resources, workload or harness changes. Manually supplied floors without that
provenance are labeled unverified. Per-metric relative/absolute/noise budgets can be supplied; timing remains
report-only. A suite with at least five repetitions writes calibration only when all trials qualify.

`--browser-live` opens Explorer before publication, verifies an initially absent fixture,
then measures new rows, search and task/result navigation while the producer runs. It also
requires the final task/result to render. Launch-to-paint includes producer startup/warmup
and Explorer polling; it is deliberately not called publish-to-paint latency. A browser failure
does not discard the producer's independent correctness report. This scenario uses one unthrottled
browser and is distinct from `--browser`'s post-ingestion loading/vitals journey.

`.github/workflows/benchmark.yml` measures the immutable regular image from a successful trusted
main push build. Its qualified core uses 10k retained tasks, 128 new tasks at 20 events/s,
240 API requests at 12 requests/s, and 2 CPU / 2 GiB. The 100/500-events/s and API-overload
observations remain separate stress evidence; this workload is not a maximum-capacity claim. The build handoff records the digest, source SHA and build run/attempt. Measurement
checks both a clean exact checkout and the image's OCI revision. It has read-only permissions;
the separate publisher has the write permission needed for the `benchmark-results` branch.

The publisher stores `runs/<source-sha>/<run-id>-<attempt>.json`, a comparison JSON and Markdown,
plus a generated index/README and an SVG trend chart with separate series and visible gaps. Compact evidence preserves metric values/counts, workload identity
and bounded latency histograms; large samples/logs remain workflow artifacts for 30 days. Identical
publication retries are idempotent; conflicting records are rejected. Failed/incomplete results stay
visible. Missing artifacts or rejected checksums/source/image identity produce an incomplete record
with no baseline metrics. Publication uses an ordinary fast-forward push; outside branch changes
fail safely rather than being overwritten.

The latest pointer follows source ancestry, then run/attempt order for the same source. Comparisons
use a recent compatible valid measurement and a fixed first-valid calibration anchor. Neither automatically becomes
an approved release or known-good performance baseline; flags remain report-only. Resource, harness
or environment changes start a separate series.

Publication is serialized with GitHub's [maximum pending queue](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency),
which holds up to 100 waiting jobs. Beyond that, publication can be canceled; retained measurement
artifacts allow rerunning the failed publisher. Publisher-only retries download the original artifact
by ID instead of substituting another attempt. Repository rules must allow the Actions token to create
and update the results branch.

Local tests exercise real Git remotes, branch creation, retries, failed results and out-of-order
completion. Hosted execution still needs verification after the workflow is merged. Actionlint 1.7.12
does not recognize the documented `queue` key; all other workflow fields are linted, and the queue
configuration is checked against GitHub's reference.

The initial 100k RocksDB profile stalled during setup with an unresponsive native server; the
same fixture completed on SurrealKV. These are separate named observations, not an automatic
storage fallback. See `docs/benchmark-calibration.md` for evidence, the misleading process-only
health response, and the incomplete/diagnostic status of the RocksDB attempts. The validated
100k SurrealKV read profile does not establish a sustainable mixed-load or resource envelope.

## Native notification burst diagnosis

Against a disposable native database with owner access, isolate notification bursts from broker
delivery and the public observation API:

```shell
python tooling/benchmark/live_burst_probe.py --url ws://127.0.0.1:19917/rpc --repetitions 3
```

This creates and removes its own uniquely named diagnostic database. Credentials default to root/root;
override `BENCH_PROBE_USER` / `BENCH_PROBE_PASSWORD` if needed. Each row is a diagnostic observation,
including persisted versus delivered counts and the active connection probe's close error. Its exit
status does not gate performance: inspect `delivery_complete`. Atomic burst limits are distinct
from steady event throughput. The database and its version/configuration must be recorded externally.

## Reviewed release references

To pin a known-good measurement, review its source/image, workload, correctness and calibration, then
commit `references.json` on the results branch. No measurement is promoted automatically. Example:

```json
{
  "schemaVersion": 1,
  "references": {
    "<64-character comparison series key>": {
      "recordId": "<40-character source SHA>/<measurement run ID>-<attempt>",
      "label": "release-v0.2"
    }
  }
}
```

Use actual IDs from `index.json`. Future publications compare against that fixed record separately
from the recent reference and first-valid calibration anchor. A failed/incomplete or incompatible
reference is rejected. An out-of-order attempt predating the approved source receives no approved
timing comparison. Changing the selection affects future reports; immutable past reports stay intact.
An approved reference alone does not enable a timing gate.

## Impact on monitored Celery workers

```shell
bun run bench celery --image <image> --repetitions 5 --output <new-directory>
```

Each pair runs 128 deterministic CPU tasks at 20 offered tasks/s, first with task events disabled and
then enabled with Insights. Pair order alternates. Every attempt uses fresh private broker/backend
storage, a 1 CPU / 512 MiB worker with two prefork processes, and cached images. The monitored app
has 2 CPU / 2 GiB. STARTED result writes and task work match in both modes. Monitor/control queues
are exclusive for compatibility with the pinned RabbitMQ version.

The controller validates every real task result. Monitored runs additionally require all sent,
received, started and succeeded events, final task results, and independent workflow summaries.
Worker completion latency includes Redis polling observation. Resource brackets include startup of
the producer, readiness, workload, post-work validation and collectors; they are not pure task costs.
Worker/app process telemetry uses their container clocks; broker/backend cgroup-only telemetry uses
controller timestamps. Deltas always subtract timestamps within the same collector clock.

`celery.json` retains all attempts, paired latency/goodput/worker CPU deltas, command evidence and
cleanup status. Invalid pairs have unavailable deltas. These schema-1 diagnostics remain separate
from the main regression-history series; one small worker fixture does not validate high worker
cardinality, expensive result scans, or a production Celery capacity recommendation.

## Debug-bundle export and snapshot replay

```shell
bun run bench replay --image <image> --output <new-directory>
bun run bench replay --image <replay-image> --source-image <older-source-image> --output <new-directory>
bun run bench replay --image <image> --format legacy-json --output <new-directory>
```

This creates a synthetic source with 128 historical tasks and 32 broker-driven tasks, exports a
redacted debug bundle v2 with scoped JSON data, and starts a separate read-only replay container.
It validates exact task/event payloads, workflow summaries and all public task memberships, rejects a
mutation, and runs the production-browser journey. The optional source image must support the current authenticated public protocol and scoped JSON
bundles. Old native SQL source images are unsupported; their older results remain historical evidence. `--format legacy-json` generates an older JSON-format fixture from the independently
captured source backup, keeping its original source archive; conversion cost is separate from export.
Export bytes/hash, export time and replay-to-validated-data time are distinct.
Scoped JSON bundles reconstruct derived workflows from stored task state after import. Native SQL
bundles are intentionally unsupported by the current application and remain historical evidence. Source/replay images are recorded separately. Private source and replay
stores are removed; the synthetic bundle, reports and logs remain. This is a bounded fixture and
separate schema-1 diagnostic, not large-incident-bundle replay capacity.
