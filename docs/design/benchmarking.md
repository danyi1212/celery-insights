# Benchmarking and resource sizing

Status: proposed design, 2026-10-10. This document plans the tool; it contains no new benchmark measurements or established capacity claims.

## Goals and decisions

The benchmark suite should answer four questions:

1. How much work can Celery Insights handle while preserving correctness and acceptable freshness?
2. How quickly can someone load, navigate, search, and interact with useful data?
3. What CPU, memory, disk, and network resources does that require as retained history and live activity grow?
4. Did a change make any of those outcomes worse?

Usefulness and trustworthy comparisons take precedence over a predetermined runtime limit. Measure the suite's setup, seeding, warmup, sampling, validation, and reporting costs; optimize the expensive parts after calibration. Separate frequent regression checks from capacity discovery and long-duration validation.

Resource recommendations are an output of the work. Publish measured deployment envelopes in the operator docs, including assumptions, headroom, and limitations. Select exploratory profiles now, but do not publish guessed minimum resources as validated recommendations.

## Existing architecture and reusable work

- Bun supervises the embedded SurrealDB process, schema migration, optional search projections, ingestion leadership, and the Python bridge. Bun serves the SPA, public HTTP endpoints, metrics, exports, retention, and MCP.
- Python receives broker events into an asynchronous queue and writes transactions containing raw events, task updates, workflow membership/summaries, and worker updates. Periodic, size-based, and terminal-event flushes all matter.
- Terminal events also fetch results from the configured result backend. Redis result polling independently scans stored result keys to recover observations; worker polling uses Celery inspect. These background paths must be represented under load.
- The browser authenticates to SurrealDB through Bun's WebSocket proxy. It issues initial queries, subscribes to LIVE changes, and periodically refreshes some aggregate views. Explorer and raw-event queries include counts, facets, and histograms alongside rows.
- Multiple app replicas sharing one database elect one ingestion leader. Additional replicas must be evaluated for read/fan-out capacity; they do not imply proportionally higher ingestion capacity.
- The runtime defaults to in-memory storage and search indexing disabled. Durable storage needs its own named profiles rather than being inferred from the default.
- `server/events/search_indexing_integration_test.py` already exercises disk-backed receiver callbacks, ingestion, result updates, LIVE notifications, and concurrent searches. Its two-second workloads bypass broker delivery and the periodic-flush path. Reuse its fixture and observation ideas, while keeping these limitations explicit.
- Existing Playwright fixtures, Compose helpers, native observation API acceptance, and database upgrade/restore tooling provide useful starting points. Benchmark jobs need quiet, controlled producers instead of the test stack's interval producer.

Relevant sources: [runtime entry point](../../bun-entry.ts), [ingester](../../server/events/ingester.py), [result fetcher and poller](../../server/tasks/result_fetcher.py), [observation APIs](../../runtime/observation-api.ts), [browser provider](../../src/components/surrealdb-provider.tsx), [existing search measurements](../search-index-validation.md), [CI](../../.github/workflows/ci.yml).

## Performance map

Every scenario declares its correctness oracle, completion condition, load shape, cache state, and applicable metrics. Error counts and missing data accompany speed measurements.

| Surface                   | Measurements                                                                                                                                                                                                        | Representative scenarios                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Event pipeline            | Scheduled, published, received, and committed events/s; event bytes/s; publish-to-visible latency; queue/buffer depth and growth; batch size and duration; retries, drops, drain time                               | Complete task lifecycles, worker events, terminal-heavy traffic, mixed interleaved tasks, steady load, burst and recovery, out-of-order/duplicate deliveries                             |
| Results and polling       | Terminal-to-result-visible latency; backend requests/s and bytes/s; scan duration and keys scanned; polling freshness; Python thread/queue use and memory growth                                                    | Small/large results, failures/tracebacks, slow backend, many historical Redis keys with few new results, tasks observed only through results, many workers                               |
| Storage and retention     | Allocated disk bytes, logical bytes, bytes/task and bytes/event, incremental growth, write amplification where observable, IOPS/throughput, DB CPU/memory, deletion duration, space reuse/reclamation, query impact | Increasing history, payload sizes, RocksDB and SurrealKV, indexing off/on, cleanup concurrent with writes/reads, aged data and repeated retention cycles                                 |
| Database read path        | Latency distributions, completed queries/s, response bytes, errors/timeouts, inspected query plans                                                                                                                  | Home summaries, Explorer rows/counts/facets/histograms, selective/common/no-match searches and fallback, sorting, increasing row limits, analytics, workflow and task detail, raw events |
| Public interfaces         | HTTP/MCP latency and throughput, errors, time-to-first-byte and completion for streams, response size, cancellation cost                                                                                            | Config/settings, metrics, CSV, database backup/import, debug bundles, worker inspect, MCP task/workflow discovery and pagination; measure lightweight and expensive endpoints separately |
| LIVE delivery and fan-out | Commit-to-notification latency, publish-to-browser-visible freshness, notifications and bytes/s/client, subscription setup/reconnect latency, connection memory, convergence after disconnect                       | One/many clients, overlapping subscriptions, high change rates, route changes, reconnects, slow consumers, simultaneous reads and ingestion                                              |
| Browser loading           | TTFB, FCP, LCP, CLS, transferred bytes, script parse/execute and blocking time, time until expected data is rendered and controls work                                                                              | Production build, fresh browser cache, repeat visit, large history, large task result, desktop and a fixed constrained device/network profile                                            |
| Browser interaction       | Scripted interaction-to-next-paint, action-to-correct-result latency, route-to-useful-data latency, long tasks, frame gaps, CPU, JS heap/DOM growth                                                                 | Search/type/filter/sort, loading more rows, task comparison, workflow graph zoom/pan, charts, JSON viewers, navigation during live updates, repeated route changes                       |
| Packaging                 | Per-platform compressed image layers and unpacked size; initial and route-loaded JS/CSS/WASM bytes, raw/gzip/Brotli sizes and actual transfer                                                                       | Regular/all image variants, native amd64/arm64, application routes, documentation, optional demo/WASM path                                                                               |
| Startup and recovery      | Image fetch/unpack, scheduling/mount, process start, DB ready, schema/search ready, read-ready, ingestion-ready, first useful dashboard, restart recovery and data correctness                                      | Empty/existing database, cached/uncached image, warmed/cold data caches, external DB, native pod creation, application/Python/DB restart, leader failover                                |
| Long-duration efficiency  | CPU-seconds per committed event/query; total working set and peak memory; browser and server memory slope; handles/threads/connections; disk slope; latency drift; impact on monitored Celery                       | Sustained mixed workload, repeated cleanup/reconnect, slow dependency/recovery, worker task throughput with and without Insights                                                         |

Use milliseconds/seconds, bytes, and workload-specific rates as primary values. Keep aggregate scores as diagnostics; a score can hide a regression in one outcome.

## Definitions that prevent misleading results

### Throughput and freshness

Report offered load and achieved goodput separately. Committed events must be validated; a queue accepting events or a batch counter incrementing is insufficient. Events/s, terminal tasks/s, notifications/s, and queries/s are distinct rates. A task lifecycle typically produces several events and database writes.

A sustainable-load candidate must meet declared freshness/error budgets, avoid monotonically growing backlog or memory, and recover after a defined burst. A short test identifies candidates; a soak validates the published operating envelope. A fast overload run with lost data cannot count as a throughput improvement.

Generators use a fixed arrival schedule independent of response completion. Record scheduled-to-publish delay, actual published rate, generator CPU, scheduling lag, and unsent work. A saturated generator makes a capacity result inconclusive. Include timeouts and missed deadlines in failure statistics instead of calculating percentiles only from successful work. This avoids hiding stalls through coordinated omission; see [k6's open/closed model explanation](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/).

Measure separately:

1. Scheduled/published event to committed observation.
2. Commit to LIVE notification.
3. Event to relevant browser data visibly updated.
4. Terminal event to expected result visibly available.

For views that refresh on an interval, freshness includes that interval. Start/end observations use a common monotonic clock where possible. Do not subtract unrelated process monotonic clocks or Celery wall-clock timestamps. Across hosts, use a controller-observed round trip or documented clock synchronization/error; state the observation and transport overhead.

### Correctness

Generate an independent expected manifest of event IDs, final task states, workflow membership/counts, errors, results/truncation, and search matches. Validate raw-event coverage, expected logical duplicates, missing/extra records, state ordering, workflow totals, and browser convergence after a bounded drain. Explicitly model records expected to expire during retention tests.

Historical fixtures can be loaded directly for read/size tests, with production schema/projections and equivalence checks. That setup does not measure ingestion. Ingestion tests traverse the intended production path and run all normal flush loops. Reuse input fixtures rather than generating expected results with the same logic being benchmarked.

### Browser metrics

Track LCP, INP, and CLS as the current Core Web Vitals, with TTFB/FCP and blocking time as diagnostics. Scripted browser sessions produce laboratory interaction measurements; they are not a representative production INP distribution or proof of field Core Web Vitals compliance. Lighthouse navigation audits cannot measure INP without interactions; see [Web Vitals](https://web.dev/articles/vitals).

TTI may be retained for compatibility if a tool supplies it, but it should not be a new gate: [Chrome documents its removal from Lighthouse 10](https://developer.chrome.com/docs/lighthouse/performance/interactive/). Prefer an explicit app-ready marker plus interaction measurements.

For this application, a skeleton or connection screen can produce a good LCP while data remains unavailable. Add a marker for expected rows/chart/workflow content rendered and controls usable. Measure SPA navigation from click to the new route's useful content; do not treat initial-document LCP as a measurement of every route change. Search completion includes configured debounce and the correct results being painted.

Live connections make network-idle an unsuitable ready condition. Assert expected fixture content and observe a rendering milestone. Keep one measured Chromium session for frequent runs; protocol clients can supply fan-out load without pretending to measure rendering in every client. Use production builds, a fixed viewport/device/network profile, and separate warm/cold browser cache runs. Report browser run median/range when only a few repetitions exist, rather than a spurious p95 from three page loads.

### Storage and startup

Report actual allocated disk as well as logical payload size. Include tasks, raw events, workflows/relations, search projections/indexes, and engine/WAL overhead. Attribute per-table overhead only if the engine supports it or matched experiments establish it. Large-results and search projections can dominate a count-only fixture.

Deletion, reusable engine space, and filesystem space returned are separate outcomes. Specify idle/compaction wait and measurement point. Measure storage slopes at several sizes rather than extrapolating one small sample indefinitely.

Define startup cases explicitly:

- Cached-image start: image already present; new container, with empty versus existing data recorded separately.
- Uncached-image start: required layers absent on a disposable node; record registry/network conditions and pull/unpack time.
- Existing-data restart: retained database, with page-cache state recorded; it is not automatically a cold-cache run.
- Recovery: crash/restart or leadership change; verify observations and restored freshness afterward under the transport's documented guarantees.

The current `/health` response reports process presence/status; it does not prove broker consumption and a completed result path. Read-ready means a real viewer query works. Ingestion-ready means a probe event traverses the real pipeline. User-ready means expected data is painted. Pod startup adds scheduling, storage attachment, container runtime, and probe delays; Compose timings alone cannot establish pod startup claims. See [Kubernetes lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/) and [image cache/pull behavior](https://kubernetes.io/docs/concepts/containers/images/).

## Fixtures and selected workload profiles

Use deterministic seeds, versioned fixture manifests, reproducible event schedules, and a run-relative reference time. Distribute history across fixed windows (for example one hour, one day, and one week) so range queries do not accidentally exclude it. Model both common and high-cardinality task/worker/type distributions and chains/groups with small and unusually large workflows.

Initial history candidates, to be adjusted during calibration:

| Profile     | Retained tasks | Approximate raw task events | Use                                              |
| ----------- | -------------: | --------------------------: | ------------------------------------------------ |
| Small       |          1,000 |                       5,000 | Tool smoke, correctness, startup                 |
| Medium      |         10,000 |                      50,000 | Frequent UI/query regression checks              |
| Large       |        100,000 |                     500,000 | Scale curves and resource sizing                 |
| Extra large |      1,000,000 |                   5,000,000 | Manual/release capacity validation when feasible |

The event counts are fixture proposals, not a fixed events-per-task rule. Record actual workers, workflows, relations, event types, key cardinalities, payload bytes, and result-backend keys. Version the state/retry/failure distribution rather than using uniformly successful flat tasks.

Include a normal payload mix and a heavy-payload fixture with 16 KiB arguments, results around the current truncation boundary, oversized results, and large tracebacks. Keep broker bytes, retained result text, and notification bytes distinct.

Start discovery around 100, 500, and 1,000 offered events/s, then bracket the capacity knee. These are exploratory rates, not promised capabilities. After discovery, pin below-capacity regression rates per profile; never silently lower a rate to make a candidate pass.

Use selected scenarios instead of the Cartesian product of every dimension:

- Default behavior: memory storage, search indexing off, normal payloads, real RabbitMQ/Redis pipeline.
- Durable regression profile: RocksDB, medium history, default indexing, mixed ingestion plus representative reads and a measured browser.
- Search tradeoff: matched indexing off/on runs on a fixed dataset, with selective and common/fallback searches during ingestion.
- Large history: large retained data, fixed ongoing write rate, expensive range/facet/analytics queries, multiple protocol clients.
- Heavy events/results and large-workflow stress: separate fixtures expose different write, network, and rendering costs.
- Topology/persistence validation: SurrealKV, external shared DB/read replicas, alternate broker, reverse-proxy prefix, all image, native arm64; rotate or run before release.

Keep pure read/ingest experiments for attribution, plus a mixed experiment for real contention. Separate normal-traffic runs from failure injection and export/cleanup interference.

## Resource recommendations as a deliverable

Discover a response surface across offered load, retained bytes/history, clients, and resources. Begin with an exploratory diagonal such as 0.5 CPU/512 MiB, 1 CPU/1 GiB, 2 CPU/2 GiB, and 4 CPU/4 GiB for the combined Insights container. These are test points, not recommended configurations. Bracket CPU and memory independently near the useful operating points; report OOM or inability to start rather than dropping those samples. Allocate and report broker/backend/generator/browser resources separately so they do not masquerade as app capacity.

Measure whole-container cgroup CPU, throttling, peak/steady working set, OOM/restarts, disk/network, and per-process Bun/Python/SurrealDB use. The existing `/metrics/system` RSS gauge is Bun's RSS, and host load average is not per-container CPU utilization. Supplemental external collection is necessary. For an external DB, document app and database resources independently.

Each recommendation should include:

- Topology, storage engine, architecture, tested versions, fixture/workload version, and tested hardware/storage class.
- Sustained events/s and terminal tasks/s, retained tasks/events/GiB and time window, payload distribution, result-backend key count, clients, and query mix.
- Freshness/latency/error budgets met, duration verified, burst tolerated and recovery deadline.
- CPU/memory requests and limits, observed CPU-throttling behavior, disk allocation and I/O requirement, peak memory, and network use.
- Explicit operating headroom and a link to benchmark evidence; a sizing curve for needs outside the examples.

As a starting engineering policy, recommend a load below the validated knee (for example 70–80% of it), and sufficient memory/disk for measured peaks, retention overlap, compaction, and the declared burst. Calibrate that policy with the soak and recovery tests. Disk sizing should follow measured growth for the chosen payload/retention/indexing mix, not a universal bytes-per-task assumption. Publish a few clear deployment examples only after their envelopes pass validation.

Measure monitoring overhead on the Celery cluster too: paired runs with Insights disabled/enabled, fixed worker resources and tasks, task completion latency/throughput, broker/backend CPU and request rates. This prevents a recommendation that is affordable for Insights but costly for the workload being monitored.

## Run tiers and efficiency

| Tier                | Trigger                                            | Contents                                                                                                                                                            | Decision policy                                                                   |
| ------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Artifact and smoke  | Relevant PR/build                                  | Bundle/image sizes when artifacts exist, small correctness fixtures, basic startup/query/browser milestones                                                         | Deterministic size budgets and correctness can gate once calibrated               |
| Regression core     | Successful main build; selected relevant PRs later | Fixed durable medium fixture, normal ingestion/results, representative viewer queries and public/MCP calls, mixed load, LIVE/browser journeys, cached-image restart | Report first; promote stable metrics to regression gates after measuring variance |
| Scale and sizing    | Scheduled/manual                                   | Large history, selected resource/rate/client steps, indexing/storage tradeoffs, cleanup/export contention, polling cardinality, browser memory trend                | Capacity/resource envelopes and regression trends                                 |
| Soak and deployment | Release/manual; scheduled subset when justified    | Long mixed load, repeated retention/reconnect, validated bursts, fault recovery, leadership, native pod cold/warm starts and architecture variants                  | Validate documented recommendations and release risks                             |

No runtime promise is set yet. Calibration determines minimum useful sampling lengths and the total cost. Record seed and setup timing separately from measured workload time; database creation, index readiness, drain, correctness checks, and cleanup have explicit deadlines. Budget exhaustion or a timeout produces an incomplete/failed result, not a pass.

Efficiency tactics:

1. Reuse the exact production image and frontend artifact from a successful build; identify them by source SHA and immutable digest.
2. Cache dependencies/browser binaries and versioned historical seed artifacts. Restore to fresh writable state per independent sample, and validate schema/fixture compatibility. Physical snapshots are engine/version-specific; logical fixtures are the portable source of truth.
3. Seed read-scale history directly; replay through the broker only when measuring ingestion or validating fixture equivalence. Prepare representative Redis history for poller tests too.
4. Reuse the environment within a named scenario where intended, while resetting mutations and explicitly controlling cache state between samples/scenarios.
5. Run independent scenario jobs in parallel on separate runners when helpful. Keep competing benchmark processes off the same constrained host, except where contention is the declared scenario.
6. Collect lightweight telemetry at a fixed modest frequency. Do not repeatedly run table-count/aggregate metric queries during a timed phase: the current metrics handler can itself add database load. Measure instrumentation overhead and keep instrumentation equivalent between builds.
7. Capture full traces/profiles in a separate diagnostic rerun after a flag, while preserving the original measurement. Keep normal metric collection small and avoid traces altering every timed browser run.
8. Calibrate variance with repeated independent trials; assign more repetitions to noisy metrics. Use predeclared sampling/checkpoints and deadlines so adaptive stopping cannot cherry-pick a favorable outcome.

## Regression decisions

Store latency histograms/sample counts, rates, resources, correctness, and repetitions. Compute p50/p95 and supported p99 within request/event runs; do not average individual p95s into a global p95. Across independent runs compare distributions of per-run summaries. Treat low-sample metrics as low-confidence/report-only.

Compare only compatible metric definitions, benchmark/fixture revisions, storage/indexing/topology, resource allocations, architecture, browser/tool versions, cache mode, and runner environment. Keep application/dependency versions as attribution fields; a change to them is something the suite should detect. An intended environment or workload change starts a new series, ideally with overlap runs to preserve a bridge.

Use both a rolling reference of recent valid comparable main results and a fixed release/reference anchor. The latter detects many small regressions that a rolling reference can absorb. Record actual source order, rather than assuming workflow completion order matches commit order.

For a lower-is-better metric, a provisional flag is:

`candidate - baseline > max(relative_budget * baseline, absolute_budget, calibrated_noise_floor)`

Reverse direction for higher-is-better metrics. Budgets are per metric; establish absolute product budgets for freshness and interactions separately. Thresholds such as 10–15% are initial calibration candidates, not universal rules. Require reproducible evidence before a noisy timing becomes a gate. Correlated metrics provide diagnosis rather than dozens of independent hard failures.

Use previous results to identify suspects cheaply. Confirm flagged scenarios with a baseline/candidate paired run on the same controlled runner, restore/reset between samples, and alternate execution order to reduce drift. Rerun only suspect scenarios; retain all attempts and do not replace an unfavorable original with a favorable retry. If the baseline also degrades or generator/environment health fails, report inconclusive rather than blaming the candidate. A resource cap reached only by the candidate is an outcome to report, not generic environmental invalidity.

Correctness failures, unexpected loss, crashes, or failure to drain have their own explicit failure status. Report timeouts, unsupported/unavailable measurements, and invalid samples as such, never zero or improvement. Hosted CI results should initially support trends and coarse alerts; resource quotas alone do not make variable hardware/storage comparable. Stable hardware or controlled confirmation is needed for tight gates and published sizing claims.

## Tool interface and implementation shape

One benchmark module owns lifecycle, manifests, timing, validation, comparison, and reports behind a small CLI. Proposed commands, not existing functionality:

```shell
bun run bench --suite core --image <immutable-image> --output <directory>
bun run bench --suite scale --profile durable --output <directory>
bun run bench compare --baseline <result.json> --candidate <result.json>
bun run bench report --input <results-directory> --output <report-directory>
```

Scenario manifests declare prerequisites, fixture, load shape, resource/cache configuration, readiness/completion checks, metrics, repetitions, and budgets. They do not require callers to orchestrate internal processes. Start with concrete helpers; introduce deployment adapters when both Compose and Kubernetes implementations exist.

Suggested implementation choices:

- Bun/TypeScript orchestrator and result/report schema to fit the runtime/tooling; Python Celery event/result producers using the actual broker protocol.
- Real production native SurrealDB and production images for authoritative server results. WASM/demo measurements remain separately named browser/demo scenarios.
- Existing SurrealDB SDKs for production viewer queries and LIVE clients; reuse production query builders where available. Where queries live inside React hooks, make query definitions reusable without maintaining a parallel approximation that can drift.
- k6 for HTTP fixed-arrival workloads; SDK-specific scheduling for SurrealDB/MCP protocol journeys where it preserves the real interface. Track both k6 unsent iterations and application errors; see [arrival-rate behavior](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/) and [dropped iterations](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/dropped-iterations/).
- Playwright/Chromium with performance observers, benchmark readiness/rendering marks, and scripted journeys; optional Lighthouse diagnostics for a small navigation subset.
- Container/cgroup and process telemetry, filesystem/image/build artifact inspection, and Kubernetes lifecycle observation for the deployment tier. No mandatory hosted benchmarking service is needed for the first version.

Add missing observability before treating the suite as authoritative: flush duration/batch counts, received/committed/retried/dropped counts, result-fetch/poll durations, ingestion readiness, app data-ready milestones, and lightweight collection. Avoid high-cardinality metric labels; correlate sampled event IDs in benchmark sidecars rather than emitting one Prometheus series per task.

## Results, CI, and history

Each immutable run summary records:

- Run/schema/scenario/fixture/harness versions and seed; source SHA, parent/reference SHAs, build/image/platform digests and dependency versions.
- Runner hardware/OS/kernel/storage class and resource limits; broker/backend/DB topology and versions; browser and instrumentation configuration.
- Planned and actual load, payload/history/client dimensions, warmup/sample/drain durations, repetitions and sample counts.
- Metric values/units/directions, histograms or compact distributions, correctness/error status, generator/runner health, comparison budgets/noise/confidence, and artifact links/checksums.

Write JSON as the source of truth and generate a concise Markdown summary plus charts from it. Reports show current values, comparable baseline, absolute/relative delta, and status. Scale reports plot freshness versus offered rate, latency versus history, disk versus retained bytes, and resource use versus goodput; mark tested resource recommendations on those curves. Keep short-run estimates distinguished from soak-validated envelopes.

The proposed Git history approach is useful. Publish compact append-only summaries to a dedicated `benchmark-results` branch, one file per source SHA/run ID/attempt, with a generated index and latest view. Store sufficient run-level evidence and compact histograms there for future comparisons; large traces, profiles, and logs remain workflow artifacts with an explicit retention policy. [GitHub artifacts have configurable retention limits](https://docs.github.com/en/actions/tutorials/store-and-share-data), so artifact links alone are not permanent benchmark history.

The main source branch keeps benchmark code, fixture manifests, budgets, this design, and validated resource documentation. The result branch retains time-series Git history without a new source-build trigger for every measurement. Repeated runs never overwrite one another. Serialize the final publishing job and update latest by source ancestry/order so a slower older run cannot replace a newer one; measurement jobs can run independently.

Trigger core benchmarking after the relevant production build succeeds, using that build's recorded source SHA and digest rather than whichever `main` or `latest` happens to exist when the benchmark starts. Publish the summary/artifacts even on a regression or incomplete run. A timing regression should not silently become the approved baseline; track a known-good reference explicitly while retaining every result.

Use a minimal write-enabled publisher for trusted main results; PR benchmark jobs can be read-only and publish workflow artifacts. Restrict triggers to the source branch and generate any optional history report in the same publishing workflow. GitHub documents that ordinary pushes with `GITHUB_TOKEN` do not trigger another workflow, but explicit branch filters should express the intended behavior too: [workflow triggering](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow). Initial publication needs no external messages or automatically opened issues.

## Implementation sequence and acceptance

1. **Measurement contract and calibration:** implement the result/fixture/scenario schema, independent correctness oracle, readiness markers, lightweight telemetry, generator validation, and one real-broker durable scenario. Repeat on a controlled environment; measure harness cost and variance. Deliberately inject a slow path and a missing event to prove that detection works.
2. **Core coverage and report-only history:** add representative viewer queries/LIVE, result fetch/polling, HTTP/MCP, a few Playwright journeys, bundle/image inspection and cached-image startup. Publish immutable main results and an understandable delta report. Freeze selected repeatable workloads after calibration.
3. **Scale and resource discovery:** add history/payload/client/resource sweeps, indexing and engine tradeoffs, cleanup/interference, and monitored-cluster overhead. Identify candidate operating envelopes and remaining bottlenecks.
4. **Validate and document recommendations:** soak candidate envelopes, validate burst/recovery and native pod starts, then publish resource examples with their benchmark evidence. Add stable regression gates and release anchors; keep noisy metrics report-only until their confirmation procedure is reliable.

The initial version is useful when it can reproduce one full event-to-browser flow, detect deliberate slowdown/data loss, explain whether the app or generator saturated, show a compatible baseline delta, and retain auditable evidence. The resource-sizing milestone is complete when documented examples satisfy declared latency/freshness/correctness budgets under retained-history, sustained-load, and burst/soak tests.

## Open product decisions

Resolve these through calibration and review rather than choosing arbitrary limits now:

- Which freshness, useful-content, and interaction budgets describe an acceptable user experience, including views that refresh periodically?
- Which measured deployment envelopes should become the initial small/medium/large documentation examples?
- Which hardware/storage environment can support stable confirmation and resource sizing?
- Which subset delivers the most regression coverage per measured runner-minute, and which scenarios merit scheduled/release execution?
- What artifact retention/report visibility is wanted beyond durable compact Git history?
