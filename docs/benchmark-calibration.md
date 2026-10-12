# Benchmark calibration — 2026-10-10–12

These sections describe the earlier database-proxy contract. Current main uses authenticated typed reads and five-second refresh markers; old notification limits, noise floors and sizing results do not establish current behavior. Current migration evidence is in [the typed-read record](benchmark-evidence-typed-2026-10-12.json).

These are local experiments with explicit workload and duration limits. The bounded sizing example is in [resource guidance](benchmark-resources.md); broader sustainable capacity remains unproven.
The benchmark implementation is in `tooling/benchmark/`; reproduce using its README.

## Environment and path

Source-built regular production image, native Linux arm64 under Docker Desktop on Apple Silicon;
Python 3.14.8, Bun 1.4.2, SurrealDB 3.3.0, RabbitMQ 4.3.6, Redis 8.10.2, RocksDB.
The combined app container was constrained to 2 CPU and 2 GiB. Producer and observer ran separately.
Browser trials used Chromium 153.0.8010.12, 1440 × 900, no device/network throttling.
Later browser profiles explicitly record their configured throttling below. The host controller
uses Bun 1.3.10; Python test tooling uses 3.14.7. These differ from the image's pinned Bun/Python
versions and are recorded separately rather than treated as interchangeable CI environments.

Image ID: `sha256:1adc3ad162308a7f76d1660fefd0714b65dd03f46ed29cb49e535eb41d0f632f`.
Docker-reported unpacked image size: 890,164,311 bytes. This does not establish compressed pull size.

The workload sends interleaved sent/received/started/succeeded events with four-task workflow groups
through RabbitMQ. Production periodic/terminal flushes, Redis result fetching/polling, and viewer
queries are active. Task and raw-event LIVE observations traverse Bun's public WebSocket proxy.
Expected raw-event sequences, final states/results/truncation flags, workflow IDs and summaries
are checked independently. Browser checks run after ingestion, not during live changes.

## Selected observations

| Run                           | Events / offered rate       | Result payload                 | Correctness                       |                             Raw-event LIVE p95 |           Result LIVE p95 | Failed flushes |
| ----------------------------- | --------------------------- | ------------------------------ | --------------------------------- | ---------------------------------------------: | ------------------------: | -------------: |
| `raw-live-100`                | 128 / 100 events/s          | Small                          | Passed                            |                                       198.4 ms |                   17.9 ms |              1 |
| `large-results-100`           | 128 / 100 events/s          | 100 KiB before repr/truncation | Passed                            |                                       209.4 ms |                   57.2 ms |              1 |
| `rate-500-drained`            | 1,024 / 500 events/s        | Small                          | Passed after actual event drain   | Not collected in this earlier harness revision |          See raw artifact |              8 |
| `raw-live-500`                | 1,024 / 500 events/s        | Small                          | Failed; connection closed         |                                    Unavailable |               Unavailable |             18 |
| `parent-fixed-100`            | 128 / 100 events/s          | Small                          | Persisted and LIVE passed         |                                       190.4 ms |                   45.3 ms |              0 |
| `parent-fixed-500-validation` | 1,024 / 500 events/s        | Small                          | Persisted passed; LIVE failed     |                      Partial observations only | Partial observations only |              4 |
| `injected-omission-drained`   | 128 expected / 100 events/s | Small                          | Correctly rejected: 127 persisted |                         Diagnostic fault trial |    Diagnostic fault trial |             38 |

Do not compare rows as repeated samples: fixtures and harness instrumentation differ, and the
500-events/s failure includes the separate causes investigated below. Failed-flush counts include recoverable retries.
No permanent data-loss claim is established by the failed observer connection.

In the large-result trial, Explorer's first useful rows appeared in 294.2 ms and navigation to task
details took 108.0 ms. These are one desktop laboratory journey each, with zero recorded page errors;
they are not LCP/INP, p95 navigation, large-history, or live-rendering measurements.
Generator publication lag stayed below 2.5 ms in that trial. Only 14 background-query samples were
collected, so its tail estimate should not become a gate.

## What calibration changed

- **Generator setup:** first-use Redis/backend setup caused a 142 ms publishing pause. Backend
  connection warmup moved outside the timed phase; generator-unhealthy timing is inconclusive,
  even if correctness passes.
- **Completion:** Redis result polling can make all tasks look successful while raw events remain
  queued. An earlier 500-events/s snapshot saw only 640 of 1,024 events and transient workflow
  groups. Waiting for actual raw history drain produced correct history and groups. Final task state
  alone is therefore an invalid ingestion completion condition.
- **Latency:** raw-event LIVE and terminal/result LIVE are measured separately. Backfill freshness
  must not be presented as raw-ingestion latency.
- **Independent oracle:** intentionally omitting one event fails exact raw-sequence coverage despite
  correct final task/results. The fault run exits nonzero and retains evidence.
- **Failure reporting:** connection/observer errors are serialized as failed results, with complete
  producer and app logs retained rather than only a downstream JSON parsing error.
- **Storage:** the engine reported 76,220 allocated KiB both before and after the large-result trial.
  Allocation/preallocation and the short observation window make this unsuitable for incremental
  storage sizing. Larger retained histories, logical bytes, settled checkpoints, and compaction
  behavior still need measurement.

## Root-cause investigation and remaining delivery failure

The raw-event-subscription 500-events/s trial logged 18 failed batches; thirteen included
`Couldn't coerce value for field workflow_id ... Expected string but found NONE`, referring to
`bench-16`, alongside transaction conflicts. SurrealDB subsequently reported
`Closing a WebSocket whose client stopped reading its notifications`; the observer received close
code 1000. Resource samples in that failed trial showed roughly 282–351 MiB
of Docker-reported app memory, so a 2 GiB memory limit alone does not explain the failure.

The schema error is now reproduced with one child event against empty production CORE_SCHEMA,
using native SurrealDB 3.3.0. `build_children_update` creates a missing parent without the required
workflow ID. The working-tree fix initializes it from the event's root ID or the parent's own ID,
preserving any established workflow. New native tests were red before the fix and now pass both
root-known/root-unknown cases, parent enrichment, duplicate children, and workflow preservation.
The existing ingestion integration test uses SCHEMALESS task tables, explaining this coverage gap.

The fixed production image is
`sha256:ce59ad466271c463a1afedbb8634b779dcf64af096a6b8143d82739dcd0afe03`
(890,680,915 unpacked bytes). A 32-task / 100-events/s run passed with zero failed batches;
Explorer useful rows took 257.7 ms and task navigation 79.0 ms in one desktop browser journey.
These are single observations, not evidence of a speed improvement.

At 256 tasks / 500 events/s, coercion errors disappeared, but LIVE delivery still disconnected.
Independent validation now uses a separate viewer connection and proves all 1,024 raw events,
task results, and workflow summaries persisted correctly. The generator remained healthy
(maximum publishing lag 3.9 ms); persisted drain took 6.05 seconds after publication. Only 283 raw
events and 128 expected results were observed through LIVE before failure. Successful partial
samples cannot establish tail latency. Four flush failures were recoverable transaction conflicts.

A minimized direct-native probe removes Bun, Celery, schema constraints, result polling, and
concurrent reads: create records in one transaction while a Python SDK subscriber consumes them.
Three independent repetitions per size on native 3.3.0 **memory storage** delivered all 64 records,
but each 256/1,024-record burst closed the subscriber with code 1013 and reason
`Notifications were produced faster than this connection read them`. All records persisted;
77–91 of 256 and 73–87 of 1,024 were observed in these repetitions. An earlier exploratory 256
burst passed, so there is no deterministic capacity threshold established by these small trials.
The retained reproduction is `tooling/benchmark/live_burst_probe.py`; observations are in
`test-results/benchmark/live-burst-direct.jsonl`.

The [versioned native WebSocket implementation](https://github.com/surrealdb/surrealdb/blob/v3.3.0/surrealdb/server/src/rpc/websocket.rs)
closes a connection when its bounded notification queue fills. This isolates a burst-delivery
limit distinct from persisted ingestion goodput; it does not prove that the client or network was
deliberately slow. Add batch/notification-burst and reconnect/convergence scenarios rather than
silently increasing buffers or considering persisted data sufficient for a pass.

Bun's backend `onclose` currently calls frontend `ws.close()` without forwarding close code/reason.
Thus the native overload reason is lost and the observer sees normal code 1000. Close propagation
needs its own production-proxy regression coverage and fix; it remains unresolved.

Findings and follow-up are recorded on [issue #160](https://github.com/danyi1212/celery-insights/issues/160).
Local complete run artifacts are under `test-results/benchmark/<run-name>/`, ignored by Git.
Their `result.json`, `app.log`, `producer.stdout`, `producer.stderr`, `telemetry.json`, and cleanup
logs preserve the exact configuration and evidence.

## HTTP/MCP, browser, and packaging calibration

The production-image scenarios now include separately paced HTTP/MCP reads and optional
Chromium journeys after ingestion. Response contracts check actual task/result/workflow content
and exact four-event task history. HTTP 200 alone is insufficient: MCP RPC/tool errors fail.
Open-loop contract tests prove slow responses do not lower offered arrivals; generator saturation
reports dropped work as inconclusive. Failures remain in all-attempt scheduled-completion samples,
separate from successful response latency.

| Read trial                   | Fixture                |   Offered rate | Successful requests | Completed goodput | Peak in flight |
| ---------------------------- | ---------------------- | -------------: | ------------------: | ----------------: | -------------: |
| `http-browser-first`         | 32 tasks / 128 events  |  40 requests/s |           120 / 120 |   40.2 requests/s |              1 |
| `http-browser-artifacts-200` | 128 tasks / 512 events | 200 requests/s |           600 / 600 |  199.7 requests/s |              2 |

Both generators were healthy. The mix rotates six cases: HTTP config/settings-info/metrics,
MCP task overview/history and workflow overview. At 200 requests/s, each case has 100 samples;
p95 response latency ranged from 2.1 ms (config) to 10.5 ms (workflow overview). These three-second
small-history read experiments establish measurement coverage, not sustainable API capacity.
Warmup validates each contract outside timed work. New reports retain warmup cost, file hashes,
generator health, request bytes, all attempts, and resource phase labels.

A higher `requests-1000` trial scheduled 3,000 requests at 1,000/s, but the declared 32-in-flight
generator bound dropped 1,090 requests. All 1,910 attempted requests passed content checks;
completed goodput was 624.8 requests/s. Maximum scheduling lag remained 3.0 ms, but in-flight
saturation makes this result **inconclusive** for achieved offered load/capacity. Workflow-overview
p95 among attempted successes rose to 172.3 ms, versus 10.5 ms in the 200/s trial. Do not report
624.8 requests/s as an application capacity limit or compare these workloads as source revisions.
This identifies a useful next calibration point: record/tune client concurrency, resource telemetry,
and repeat compatible arrival-rate steps before defining an API operating envelope.

`--request-concurrency` is now explicit in the workload/report. Repeating the 1,000/s trial with
128 in flight (`requests-1000-c128`) still dropped 1,098 of 3,000 planned requests; all 1,902 attempts
passed content checks, but the result remains inconclusive for achieved offered load. New native
cgroup snapshots show why increasing the client cap does not restore the target: during the
3.51-second request phase (including warmup), the app consumed **6.86 CPU seconds / 1.96 average
cores** against a **2-core quota**, with **33 of 35 CPU periods throttled**. Of the continuing
processes, SurrealDB used 4.67 CPU seconds, Bun 1.86, and Python 0.26. This is evidence of app
CPU-quota saturation under the declared mixed workload, not a demonstrated sustainable limit.

Container memory current was 371,257,344 bytes and cumulative peak 374,931,456 bytes; this small
history cannot establish retention memory requirements. The raw throttled-time increment was
9.46 seconds, which aggregates throttling and must not be divided by phase wall time as if it
were a percentage. Per-process RSS is also not additive working set. Snapshots retain raw CPU,
quota, memory-stat/events, I/O counters, process identities/start times, CPU ticks and RSS;
unsupported counters are unavailable. Brackets include collector/container-exec overhead, and
processes that exit or restart are not falsely attributed by reused PIDs. Instrumentation-overhead
calibration and longer continuous slopes remain necessary before resource recommendations.

Browser timing now waits for painted expected rows, a correct no-match search and restored rows,
then the expected task result. One unthrottled 32-task journey produced useful rows in 277.7 ms,
no-match search in 355.4 ms (including sequential typing), reset in 66.9 ms, and task navigation
in 131.9 ms. Initial FCP was 88 ms and LCP-at-useful-rows 204 ms. Recorded CLS was 0.0254 and
maximum recorded laboratory interaction duration 32 ms; no long tasks or page/request errors.
Performance Observer entries and Resource Timing are retained for diagnosis. The CLS calculation
uses the [largest unexpected layout-shift session](https://web.dev/articles/cls), with tests for
session boundaries and recent-input exclusions. These samples do not establish field INP or
field-vitals compliance; SPA navigation is measured separately from initial-document LCP.

The constrained desktop profile uses the same 1440 × 900 viewport, with configured Chromium
1.6 Mb/s download, 750 kb/s upload, 150 ms latency and 4× CPU slowdown. In one 32-task trial,
useful Explorer rows took **9.65 seconds**, FCP 8.58 seconds, LCP-at-rows 9.44 seconds, and task
navigation with expected result **2.97 seconds**. Search took 712 ms and reset 133 ms. Five long
tasks totaled 562 ms; maximum recorded interaction duration was 56 ms. All content checks passed.
Configured emulation is not proof of a physical-device speed or actual transport RTT. These are
different browser profiles; do not calculate a source regression delta between them.

### Static transfer and whole-build inventory

The unthrottled and constrained Explorer-to-task journeys each fetched **2,049,466 JS/CSS
encoded body bytes**, equal to decoded bytes, with empty Content-Encoding. Explorer readiness
accounted for 1,544,899 asset body bytes in the constrained trial; task navigation loaded additional
route dependencies. This is a meaningful loading concern for direct Bun deployments. Investigate
compressed static serving or document/validate reverse-proxy compression, then repeat compatible
constrained journeys to quantify the effect. No reverse proxy is present in these experiments.

Whole production `/app/dist` inventory, including lazy/demo assets:

| Type       | Files |  Raw bytes | Gzip level 9 | Brotli quality 5 |
| ---------- | ----: | ---------: | -----------: | ---------------: |
| JavaScript |   373 | 12,225,188 |    2,518,433 |        2,273,916 |
| CSS        |     2 |    118,958 |       18,703 |           17,332 |
| WASM       |     1 | 11,970,093 |    4,134,296 |        3,233,911 |

The inventory took 1.01 seconds after timed work inside the exact production image. Computed
compression sizes do not mean the server applies compression. Whole-build totals include unfetched
language/demo chunks and cannot be presented as initial-route transfer. Native image unpacked
size remains a separate metric; compressed registry layers and pod image-fetch startup are pending.

Evidence: `http-browser-first/`, `http-browser-artifacts-200/`, and `browser-constrained-first/`.
Findings were posted to issue #160. No timing gate or resource recommendation is established yet.

## Retained history, search amplification, and storage checkpoints

Direct setup now seeds production-schema historical tasks, four raw events/task, workflow groups
of four, and 10% failures. It does not measure historical ingestion or Redis key cardinality;
raw event data is a restricted synthetic payload. Independent ID fingerprints, states, selected
rows, and complete Explorer counts/facets/histograms are validated outside timing. Queries use
the same builder as the production hook, one warmup, and three sequential samples; cache is warm.

| Query                               | 1,000 retained tasks | 10,000 retained tasks |
| ----------------------------------- | -------------------: | --------------------: |
| Task view, 50 rows plus aggregates  |              24.1 ms |              637.3 ms |
| Task view, 200 rows plus aggregates |              26.9 ms |              627.6 ms |
| Task failure filter                 |               4.8 ms |              233.2 ms |
| Task type filter                    |               8.3 ms |              444.3 ms |
| Common task search                  |              37.1 ms |              684.6 ms |
| Task kwargs search                  |              86.7 ms |              995.8 ms |
| Task no-match search                |              49.8 ms |              949.5 ms |
| Workflow view plus aggregates       |               5.3 ms |               70.2 ms |
| Workflow failure filter             |               3.6 ms |               92.2 ms |
| Workflow kwargs search              |              22.1 ms |              264.3 ms |

These are medians within single trials, not capacity, tail latency, or source regressions. The
fixture also contains 32 newly ingested tasks. A follow-up 10k query run measured 641/1,026/977 ms
for the task view/kwargs/no-match cases. Row-query plans alone do not explain aggregate cost.

At 10k history, rapid typing (10 ms/character) took 6.76–8.26 seconds to show no matches, versus
1.33 seconds for pasting a distinct uncached absent term. Outgoing CBOR RPCs decoded **after**
timing confirmed ten full Explorer requests during typing versus one during paste. The route uses
`useDeferredValue`, while the hook does not consume cancellation; this exposes request amplification.
Exact server queuing contribution still needs profiling. Reply frames crossing phase boundaries
are attributed to arrival time, not presumed to belong to the current search.

The decoded typed query also lost a character: `benchmak-no-such-task` instead of
`benchmark-no-such-task`. An explicit final-input oracle subsequently failed another run with
`nchmak-n-such-task`. This is a correctness failure under the declared rapid-input workload.
The earlier empty-result oracle accepted these wrong queries; its recorded timings remain diagnostic
observations, not successful intended-search measurements. The controlled input was updated inside
`startTransition`; the working-tree fix makes that update urgent. The rebuilt production run
`history-10000-input-urgent` passed the explicit input oracle and all pipeline/browser checks.
It still issued **nineteen** intermediate Explorer queries and took 11.94 seconds for typing,
versus 1.85 seconds for paste. This confirms input correctness separately from responsiveness;
these single timing observations do not prove that the input fix itself worsened latency.
Its image is `sha256:75f4c7447d000de312182c80586e657fcc5ff006562c4a8bd0bde5fc065c43a1`.

| Snapshot                       | 1k allocated / logical filesystem bytes | 10k allocated / logical filesystem bytes |
| ------------------------------ | --------------------------------------: | ---------------------------------------: |
| Before seed                    |                     78,049,280 / 52,017 |                      78,049,280 / 52,017 |
| After workload, engine running |                  78,049,280 / 5,933,150 |                 132,452,352 / 57,707,748 |
| After orderly shutdown         |                 10,141,696 / 10,108,553 |                  57,937,920 / 57,904,615 |

Allocation and checkpoint state matter. These include engine/WAL/index overhead, unlike the fixture's
string-field byte count. Orderly shutdown is not a compaction or retention-reclamation experiment;
neither snapshot establishes a universal bytes/task recommendation.

Evidence directories: `history-1000`, `history-10000`, `history-10000-search-diagnosis`,
`history-10000-search-rpc`, and the explicitly failed `history-10000-search-input-oracle`, under
`test-results/benchmark/`. Production image before the input fix:
`sha256:6412ede8837d0ba43394dc752cebed0d2a311ea97455342e2e2b772fb6b414bd`.

Findings were subsequently posted to [issue #160](https://github.com/danyi1212/celery-insights/issues/160#issuecomment-6100202062).
The first publication attempt was not executed because approval review hit its usage limit;
the successful retry followed the stated reset time. That comment predates the input-fix confirmation.

## Large-history availability and storage isolation

The first 100k RocksDB attempt (`history-100000-first`) hit the original 120-second command
deadline during setup. The app remained present, with 0.19 average CPU cores and 622 MB cumulative
cgroup memory peak, but the error was initially reported as an empty JSON parse. Setup now has a
separate recorded deadline (default 600 seconds), retains command diagnostics, and reports
incomplete setup explicitly. Pre-failure resource snapshots and final container state are retained.

The longer RocksDB attempt (`history-100000-calibrated-setup`) acknowledged 10k seeded tasks in
4.69 seconds and 20k in 22.20 seconds, then stopped making visible progress. A fresh native
WebSocket handshake timed out, native `/health` timed out after three seconds, and the production
worker poller logged database keepalive failures. Native threads were waiting on futex/epoll and
generator CPU was 0%; this is not evidence of CPU-quota saturation. Bun `/health` still returned
200 with `status:ok` in about 10 ms, demonstrating that process presence does not prove DB readiness.

After preserving a read-only live copy of the private store for recovery diagnosis, the confirmed
stalled seeder was explicitly stopped. The orchestrator reported incomplete setup (exit 137),
retained diagnostics, and removed its own containers/volume. The 161 MiB physical archive is **not**
proven consistent or approved as a fixture baseline; its size/hash and probe observations are in
`availability-diagnosis.json`. No 100k RocksDB query/storage capacity result is established.

The symptoms resemble [upstream RocksDB stall report #7536](https://github.com/surrealdb/surrealdb/issues/7536),
which describes serial writes, low CPU, blocked threads, unresponsive endpoints and an unaffected
SurrealKV control on older versions. Our production binary is 3.3.0. Similarity is a hypothesis;
native-only minimization and recovery are still needed to identify the same underlying fault.

The same fixture and image on **SurrealKV** (`history-100000-surrealkv`) completed setup in
45.61 seconds (45.45 writes, 0.11 count validation), with zero transaction retries. It passed
independent IDs for 100k tasks, 400k events, 25k workflows and 100k membership edges, all query
selection/aggregate checks, and the subsequent real 128-event pipeline including LIVE/results.
There were zero failed flushes. This strengthens the engine-specific interpretation within this
Docker Desktop arm64 environment; it does not validate RocksDB or dedicated Linux deployments.

| Full production viewer request      | Warm median at 100k history, SurrealKV |
| ----------------------------------- | -------------------------------------: |
| Task view, 50 rows plus aggregates  |                             2,618.9 ms |
| Task view, 200 rows plus aggregates |                             2,621.9 ms |
| Task failure filter                 |                               726.7 ms |
| Task type filter                    |                             1,318.8 ms |
| Common task search                  |                             3,343.2 ms |
| Task kwargs search                  |                             6,693.9 ms |
| Task no-match search                |                             5,686.7 ms |
| Workflow view plus aggregates       |                               213.6 ms |
| Workflow failure filter             |                               306.6 ms |
| Workflow kwargs search              |                             5,793.1 ms |

These are three sequential samples per case after validated warmup, not throughput or tail latency.
Do not compare this different engine directly with the small RocksDB rows as a source regression.
Independent ID/state validation took 1.85 seconds outside timing. The query phase including
warmup/plans/validation lasted 123.61 seconds, consumed 128.07 CPU seconds (1.04 average cores),
and had zero throttled periods. Setup consumed 43.19 CPU seconds over a 47.58-second resource bracket.

Allocated/logical filesystem bytes were 449,454,080 / 449,410,943 after seed and
451,411,968 / 451,370,053 after orderly shutdown. Generated string fields totaled 84,444,103 bytes;
they exclude numeric/date/schema/index/engine overhead. Cumulative memory peak was 1,532,145,664
bytes during setup. After queries, current cgroup memory was 1,093,988,352 bytes, including
413,507,584 inactive-file bytes. These are not additive per-process RSS or a recommended RAM quote.
Resource sizing still needs sustained writes/reads, payload mixes, retention, bursts and soak.

The existing large trial records engine selection in the invocation and app startup logs. Future
runs additionally retain selected **actual container** runtime settings (storage/indexing) alongside
resource limits, avoiding inference from defaults or leaking unrelated environment credentials.
Query failures now retain completed cases/samples and identify the failed stage; partial successful
samples cannot describe the tail of a failed run.

The availability finding is recorded in [issue #160](https://github.com/danyi1212/celery-insights/issues/160#issuecomment-6100280355).
The SurrealKV control and resource/query observations are recorded in a
[follow-up comment](https://github.com/danyi1212/celery-insights/issues/160#issuecomment-6100364366).

Current verification: **634 frontend/runtime/tooling tests passed in 70 files** with native 3.3.0,
including two new tests proving query failures retain earlier samples and identify the failed stage.
The **11 targeted Python oracle/native-ingestion tests** passed; type, lint and format checks passed.
An intentional `--seed-timeout-seconds 1` run (`injected-seed-deadline`) exited nonzero with
incomplete setup, retained killed/deadline/exit-code diagnostics and before/after resources, and never
fabricated pipeline measurements. Its selected actual container settings were recorded correctly.
The completed and diagnostic projects cleaned up their private containers/volumes.

## Remaining scope

### Browser observation during ingestion

The new `--browser-live` scenario starts from a verified empty `bench-` search before launching the
real producer. It observes expected task rows, searches an already observed task, navigates to its
expected result, and requires the final task/result to render. The producer's independent history,
workflow/result and LIVE oracle remains separate. An initial trial exposed a duplicate-link locator
in the harness; it was corrected and that failed attempt retained.

A 1k-history/32-task confirmation passed with all 128 events/results and no flush failures.
On 10k history, a named 128-task/20-events/s scenario passed all 512 events/results and browser
checks with no failed flushes. First rows appeared 6.35 s after producer launch, searching an observed
task took 62.5 ms, navigation to its result took 1.65 s, final rows appeared at 28.53 s, and final-result
navigation took 99.9 ms. These are single local observations. Launch-to-paint includes Docker startup,
backend warmup and Explorer polling; result navigation may wait for a task still completing.
Neither measures browser publish-to-paint latency or establishes a sustainable resource envelope.
The original 100-events/s CI profile is unchanged; the 20/s diagnostic is a different scenario.

Evidence: `live-browser-1000-first/`, `live-browser-1000-confirmation/`, and
`live-browser-active-10k/` under local `test-results/benchmark/`. Fan-out, reconnect convergence,
repeated browser memory/vitals and heavier interactions remain to implement.

### CI publication implementation

The main-build digest handoff, separate measurement workflow and write-enabled publisher are now
implemented locally. A disposable real Git remote test validates creation of a results-only branch,
immutable/idempotent append, failed attempts, source-ancestry ordering and cleanup without changing
the application checkout. Missing or rejected evidence stays incomplete and cannot become a reference.
Compact summaries assert unchanged metrics/sample counts and comparison identity before publication.

References are recent valid measurements and a first-valid calibration anchor, not approved release
baselines. Timing remains report-only. Hosted workflow execution and approved references remain unverified. Five-run empirical noise calibration is implemented; real repetition evidence is recorded separately. Raw artifacts retain 30 days; compact results persist in Git.

### LIVE reader and native queue controls

Added explicit `--reader-mode shared|separate|none` scenarios. A query on a separate connection
retains its 100 ms pacing; `none` supplies only the LIVE consumer. Modes are comparison-contract
fields, so removing contention cannot masquerade as an improvement to the original workload.
An end-of-window connection probe now captures a disconnected SDK subscription: the Python SDK
receive loop absorbs transport closure while the subscription generator can wait indefinitely.
Final persisted correctness remains independent, and an unobserved drain latency stays unavailable.

All controls used the same production image, 2 CPU/2 GiB, RocksDB, indexing off, 10,000 historical
tasks and 512 offered events at 100/s. Public-interface/browser phases were omitted to isolate the
ingestion interval; they occur after ingestion in the earlier full profile.

| Control                       | LIVE delivery         | Persisted correctness | Interpretation                                                                               |
| ----------------------------- | --------------------- | --------------------- | -------------------------------------------------------------------------------------------- |
| `live-reader-shared-10k`      | 154/512; disconnected | Passed                | Reproduces loss; SDK reported a pending-query `KeyError` after closure                       |
| `live-reader-separate-10k`    | 512/512               | Passed                | One successful control; raw-event LIVE p95 10.98 s and drain 10.54 s remain poor             |
| `live-reader-none-10k`        | 151/512; native 1013  | Passed                | Loss does not require the background list query; no query samples, drain latency unavailable |
| `live-buffer-1024-shared-10k` | 512/512               | Passed                | Larger queue absorbed this trial; raw-event LIVE p95 8.37 s and drain 7.78 s remain poor     |

SurrealDB documents a default per-connection channel capacity of 100 with separate reply and
notification queues in 3.3, closing clients when the notification queue fills.
[Official environment-variable reference](https://surrealdb.com/docs/reference/cli/surrealdb-cli/environment-variables).
The benchmark now exposes `BENCH_NOTIFICATION_BUFFER`, records the actual native environment value,
and rejects timing comparisons across capacities. The larger queue is a diagnostic test point;
memory cost, fan-out, slow-client behavior, sustained operation and recovery remain unvalidated.
Moving queries alone is not established as a remedy, and neither successful delivery control meets
a demonstrated low-freshness operating envelope. Confirmation runs retain the default and larger
queue configurations separately; the original default workload remains required.

The final confirmation pair has identical recorded harness hashes and production image.
`live-buffer-100-confirmation-10k` delivered 285/512 events before native 1013, while all events/results
persisted. The late transport probe preserved that cause despite the SDK's pending-query `KeyError`.
Failed flush batches were 45, 46, 97 and 98 events; batching/retries can therefore produce notification
bursts even though arrivals are paced at 100/s. This is a mechanism to investigate, not a proven
per-batch causal trace.

`live-buffer-1024-confirmation-10k` delivered all 512 events and passed persisted/result correctness.
It took 31.794 s including setup/cleanup, with raw-event LIVE p95 **9.71 s**, drain **9.16 s**, and six
recovered flush failures. Two larger-queue trials passed versus repeated default-queue failures;
this supports queue saturation as a contributor but does not remove ingestion delays or establish
that increasing the production default is appropriate. The independent native atomic-burst controls
and this real-broker workload cover different load shapes. Resource sizing still needs sustained
fan-out, payload, memory and burst/recovery validation.

Final verification: **664 repository tests in 72 files**, including production-version native
database integration and the real-socket proxy test, passed. The five Python correctness-oracle
tests, type/lint/format checks and Git whitespace validation passed. Private benchmark containers
were cleaned up. These diagnostic controls add coverage; hosted CI verification and the wider design remain
unfinished.

### Same-image comparison and representative CI calibration

Schema-3 comparisons now reject incompatible fixtures, harnesses, resource limits, actual storage/index
settings, dependency service images, browser profiles and runner environments. Application/image changes
remain attribution fields. Results and comparison directories refuse overwrites. Deliberate slowdown,
incomplete/failed candidates and incompatible baselines have separate tested outcomes.

Two independent runs of the same production image (`comparison-core-b` / `comparison-core-c`)
produced **12 provisional timing flags**, including initial useful content 259→380 ms, LCP 176→292 ms
and browser CPU 0.216→0.306 seconds. These correlated differences are calibration evidence, not
12 application regressions. Two repetitions cannot establish noise floors or justify timing gates.
The comparator remains report-only. This implementation slice passed 647 tests across 71 files.

The proposed medium CI profile (`ci-core-profile-local`) kept 10,000 historical tasks and offered
512 events at 100/s, followed by 240 mixed HTTP/MCP requests at 40/s, three samples of each full
Explorer query, a browser journey and artifact inspection. It took **104.98 seconds** including setup,
validation and cleanup. Persisted correctness passed, but LIVE delivered only **275/512** events before
disconnecting; all 128 expected results arrived. Native logs explicitly report closing a client that
stopped reading notifications. Four ingestion flushes had retriable transaction conflicts. Maximum
publisher lag was 74.83 ms, below the current provisional 100 ms threshold.

The mixed public-interface workload dropped **111/240 scheduled requests** at its 32-request concurrency
cap; scheduling lag of attempted requests stayed below 7.35 ms. It is inconclusive for offered-rate
capacity. Full-query medians included 705 ms for all tasks, 1,300 ms for kwargs and 1,822 ms for no-match;
the independently checked query and browser journeys passed. The workload must retain this failed
attempt rather than silently reduce its event/request rates to manufacture a passing CI baseline.

The Bun proxy discarded the native backend close code, turning overload into `1000` (normal closure).
The runtime now preserves valid backend codes/reasons and maps abnormal transport termination to
`1011`. A real Bun socket regression check covers normal, failure, restart, overload, application and
abrupt closes. This improves diagnosis; it does not resolve notification backpressure or transaction
conflicts. A repeat of the unchanged production workload is retained as `ci-core-profile-close-fix`.

That repeat completed in **96.595 seconds** on image
`sha256:1fcc2732576e9d0655a9ff8ceae623d049640db6f388a0bb379711a019d784b5`.
It correctly reported `1013` with the reason “Notifications were produced faster than this connection
read them.” LIVE delivered 159/512 events, persisted correctness passed, and all 128 results arrived.
Maximum publication lag was 8.75 ms; six flush failures recovered. HTTP/MCP completed 184 successful
requests but dropped 56 scheduled requests; query and browser oracles passed. Differences in delivered
counts, drops and duration are not a measured performance effect of the close-reporting patch.
The unchanged profile still fails and provides no sustainable-capacity claim. Native burst controls
already reproduce notification overflow without Bun, but the exact interaction of ongoing queries,
batch/retry shape and notification delivery in this mixed profile remains to isolate.

The full repository suite passed **661 tests in 72 files** after the runtime change; the subsequently
added real-socket check passed with all **15 targeted closure tests**. Type checking, lint, format and
whitespace checks passed. This confirms error classification, not a fix for overload or a completed
CI publisher. Benchmark/private container cleanup completed; unrelated running stacks remain outside
the controlled benchmark and limit use of local timings as stable resource recommendations.

Current coverage also includes empirical five-run noise calibration, sequential named suites, continuous
cgroup/process sampling, bounded burst/soak, cached restart and repeated retention/export/import checks.
Remaining validation includes notification reconnect/fan-out, mixed API traffic during writes, broader
resource/payload/retention sweeps, generator and instrumentation overhead, worker/result-key cardinality,
crash/leader recovery, registry-cold pod pulls and hosted CI publication. Timing gates remain report-only.
The design in `docs/design/benchmarking.md` remains the full implementation objective.

## Verification of this implementation slice

The combined `core-resources-smoke` production run passed ingestion correctness/LIVE delivery,
all 120 HTTP/MCP requests, the browser search/result journey, and artifact inspection, with zero
failed flushes. Native cgroup snapshots completed for all three phases. This confirms the collectors
operate together; it does not extend the small fixture into a scale or resource-sizing claim.

Repository verification: **630 frontend/runtime/tooling tests passed in 69 files**, including native
search-index, search-vector and MCP integration against the checksum-verified official macOS arm64
SurrealDB 3.3.0 CLI. **59 Python ingestion/oracle tests passed**, including both native ingestion
integration suites on 3.3.0. Type checking, targeted Python/TypeScript lint/format checks, and Git
whitespace validation passed. An initial sandboxed full test attempt could not bind localhost;
the successful run used allowed local networking and the production-version CLI, rather than
counting permission failures or the preinstalled 3.0 CLI as application evidence.

## Bounded sustained and maintenance evidence — 2026-10-11

At 1 CPU / 1 GiB, the five-minute 20-events/s run passed all 6,000 new events, results, workflow
membership, LIVE delivery, live-browser checks and restart validation. The 15-minute run added a
five-second 100-events/s burst and passed all 18,400 new events. Its raw-event LIVE p95 was 333 ms,
steady CPU averaged 0.53 cores, and cumulative memory peaked at 621 MiB. Seventeen transaction
conflicts recovered. Growing retention and cache produced a positive memory slope; this is not a
leak diagnosis or unlimited-capacity claim. [Resource guidance](benchmark-resources.md) gives the
workload, headroom, disk and restart limits.

The indexed fixture now uses production normalization and populates task/workflow search projections.
A 128-history/32-new-task production run passed all ten Explorer query cases, ingestion/LIVE validation,
backup validation and two cleanup/import cycles. Each cycle retained the new tasks, removed historical
tasks, checked workflow membership/state counts and restored the original dataset. Cleanup took
671/757 ms and import took 2,206/2,329 ms. An initial harness assertion wrongly included two readiness
heartbeats in the task-event count; the failed attempt is retained and the oracle now validates those
heartbeats separately. These cycles test count-based retention after writes stop, not concurrent replay
or engine compaction.

The compact [evidence summary](benchmark-evidence-2026-10-11.json) retains image identity, dirty-source
attribution, actual configuration and SHA-256 hashes of the raw local results. Local evidence must not
be relabeled as a clean CI baseline. The immutable CI publisher deliberately rejects such attribution.

### Native pod readiness

The disposable kind v0.33.0 / Kubernetes v1.37.0 arm64 run passed cached-image empty-store
and retained-store readiness, independent ingestion/persisted-data validation and the production UI.
Creation-to-container-start was 1 s in both cases; real viewer-query readiness was 2 s / 3 s.
Controller apply-to-full-validation was 9.08 s / 7.10 s, including producer-pod scheduling. Cluster
setup took 26.85 s and native-platform image export/import took 10.03 s; these are separate costs.
The probe runs once per second and Kubernetes timestamps have limited resolution. Node/container
wall timestamps differed from controller wall time, so timings use within-clock differences; absolute
timestamps do not establish cross-host order. Registry cold pulls and cloud scheduling/storage are excluded.

Two incomplete setup attempts are retained: kind could not import a partially cached multi-platform
index, and a root-owned hostPath prevented the non-root database from opening its store. The harness
now exports only the measured native platform and prepares ownership of its private data directory.
Every attempt removed its own cluster and used a private kubeconfig.

### API during ingestion and the larger maintenance gap

The named 1 CPU / 1 GiB, indexed 1k-history, 128-new-task/20-events/s trial passed all 512 events,
complete LIVE delivery, production-browser convergence and all 180 fixed-arrival HTTP/MCP requests
at 5/s. Task-count growth independently witnessed concurrent writes. Per-case response p95 values
were 3.08 ms for config, 4.43 ms for settings info and 11.99 ms for a stable historical task. No
requests dropped; this bounded light mix is not API capacity. Restart validation also passed.

The complete trial is **failed**: the first retention cleanup lost its HTTP connection after 21.37 s.
The raw 2.08 MB export and failed attempt are retained; final benchmark data still validated. Request
idle timeout and slow/indexed cleanup are hypotheses pending a control, not established causes.
An earlier incomplete attempt hit a harness bug: the post-restart maintenance collector used the old
ephemeral host port and retried indefinitely. The harness now refreshes that address and applies
connection/authentication/query deadlines. Neither attempt is a valid regression baseline.

### Five same-image repetitions

The sequential small-core preset (1k history, 32 new tasks, 100 events/s, 2 CPU / 2 GiB, indexing off)
passed all five trials, including API/query oracles, live and post-ingestion browser journeys, restart
and artifact measurement. The suite took 160.44 s; individual complete runs took 30.35–34.14 s.
Raw-event LIVE p95 ranged 199.78–252.38 ms (median 228.16 ms); full Explorer task-query medians
ranged 25.78–28.88 ms; initial useful browser content ranged 274.25–307.05 ms. Restart validation
ranged 3.26–7.23 s. The CLI produced a compatible empirical calibration and noise-budget file;
the same-image comparison stays report-only.

These are five local development repetitions, not confidence bounds or approved release measurements.
Their image and measurement contract matched. Raw hashes and empirical per-metric ranges are retained
in the [evidence summary](benchmark-evidence-2026-10-11.json). Separate instrumentation overhead and
controlled alternating application-change confirmation are still required before timing gates.

### Backup timestamp correctness

The stronger restored-payload oracle found precision loss in a cold indexed 1k-history control:
backup import converted ISO timestamps through JavaScript `Date`, truncating sub-millisecond digits.
The native acceptance test reproduced `.123456789Z` becoming `.123Z`; using SDK `DateTime` preserved
task, event and worker timestamps and made that test pass. Production-image confirmation remains
separate from this source-level native check. The benchmark now retains restored backups and names
differing fields without dumping whole records into its failure message.

The control's first cleanup took 6.92 s and import took 92.38 s before payload validation failed.
A long import response survived, so it does not establish the earlier HTTP idle-timeout hypothesis.
The earlier disconnect remains open; these failed attempts cannot become valid performance references.

### Native leader takeover and age retention

Two native SurrealDB 3.3 checks exposed invalid duration multiplication in production queries.
Stale-lock takeover now uses `duration::from_secs`; fractional-hour task/offline-worker retention
uses `duration::from_millis`. Native acceptance tests prove stale-lock takeover, exclusion of a
second leader, and removal of old records while preserving recent records and online workers.

The rebuilt local production image (`sha256:4a769faba5c512c18cfdd9abe7fa5870e9acf56242061c21fbfc60e009c0656d`)
passed abrupt app-leader termination with arrivals paused until takeover. Election took 29.98 s;
complete ingestion validation followed at 32.88 s. A persisted sentinel and the production browser
also passed. This uses an external database that survives the app failure, not database crash recovery.

With 20 events/s continuing through the same failure, the overall result was **failed**. All 128
results appeared, but only 132 of 512 raw events persisted and workflow validation failed. Standby
leader status appeared after 50.11 s; this is not successful data recovery. Historical failed reports
incorrectly named producer completion `faultToValidatedDataMs`; that value is omitted from the
compact evidence and the harness now emits null for failed validation. The lost-history gap remains
open and cannot become a passing capacity or regression reference.

### Finalization contract

Main-run execution contract 1 records private cleanup status and complete controller cost. Only
finalized successful runs qualify as comparison references; interrupted checkpoints and older
reports lacking cleanup proof are rejected. Earlier local repetitions remain historical observations,
not measurements for this new comparison series. Raw historical reports are preserved unchanged.

### Production-image backup confirmation

On the rebuilt image, both indexed fixtures passed two cleanup/import cycles with exact restored
payloads and workflow membership, followed by final independent ingestion validation. The 128-task
fixture took 30.43 s including cleanup. The 1k-history fixture took 221.60 s; its imports took
89.86 s and 92.98 s, and count-based cleanup took 6.93 s and 6.25 s. These operations are measured
separately from ingestion rather than folded into an event-throughput figure.

Both used 2 CPU / 2 GiB. This confirms timestamp preservation in the production image, but does not
resolve the earlier 1 CPU / 1 GiB mixed-load HTTP disconnect or establish high-load import capacity.
Both finalized private cleanup successfully; compact reports and raw hashes are in the evidence file.

### Protocol-client fan-out

A 1k-history fixture with 32 new tasks at 100 events/s passed with five independently authenticated
raw-event clients: each received all 128 events, and persisted data and live browser validation passed.
The same bounded workload passed with two clients and the second consuming one event every 100 ms;
its p95 observed freshness was 11.05 s. This measures iterator consumption, including buffered backlog,
not controlled network backpressure. SDK/socket buffers can read ahead. The separate API trial started
near the end of the paced-consumer run, so these timings are diagnostic observations, not matched
capacity comparisons. Per-client counts and latencies are retained, and missing delivery rejects
otherwise passing timing references.

### Finalized five-run calibration

Five sequential small-core trials on the rebuilt image passed with execution contract 1, identical
recorded harness hashes, and successful private cleanup. Complete suite cost was 154.79 s. Raw-event
LIVE p95 ranged 209.06–576.75 ms (median 226.07 ms), task-query medians 27.20–30.21 ms, and restart
to full validation 4.03–4.96 s. The wide observed LIVE range remains visible in the empirical budget;
these local repetitions do not justify a tight timing gate. The CLI calibration and comparison passed,
with zero flags for trial 1 versus trial 5 using those noise floors. Evidence retains each raw hash,
image/harness identity, finalized costs and per-metric ranges. No local measurement was promoted to
an approved release reference.

### Real-worker fixture setup

The initial monitoring-overhead fixture failed before publishing work because its Celery 5.6 control
queue defaults conflicted with RabbitMQ 4.3's disabled transient non-exclusive queues. Both attempts
were incomplete and cleaned up. Insights already configures compatible monitor/control queues;
this was a benchmark-worker configuration error, not an Insights regression. The corrected fixture
uses exclusive queues in both modes. See [RabbitMQ queue behavior](https://www.rabbitmq.com/docs/queues)
and [Celery control configuration](https://docs.celeryq.dev/en/stable/userguide/configuration.html#control-queue-exclusive).

The first corrected pair completed all 128 real tasks per mode. Monitoring retained all 512 lifecycle
events and correct task results/workflow summaries. One pair is a correctness check; its latency
and CPU differences are not a capacity or stable-overhead claim. Repeated alternating pairs collect
worker, broker/backend and app resources separately.

### Repeated monitored-worker overhead

Five alternating baseline/monitored pairs passed, taking 195.19 s including all setup and cleanup.
Each mode completed 128 deterministic CPU tasks at 20 offered tasks/s with the same 1 CPU / 512 MiB
worker and two prefork processes. Every monitored attempt retained all 512 lifecycle events and
correct task results/workflow summaries. Publisher lag stayed within the declared health bound.

Across the five valid pairs, monitored-minus-baseline p95 completion deltas ranged -2.00 to +0.58 ms
(median +0.12 ms); goodput deltas ranged -0.030 to +0.014 tasks/s (median -0.024). Worker CPU deltas
ranged -0.248 to +0.049 seconds. Their mixed signs and this short fixture do not establish a universal
monitoring overhead percentage. Worker, broker/backend and app resource brackets remain in the
[evidence summary](benchmark-evidence-2026-10-11.json). These use the dirty local image and do not
validate many workers, expensive result scans or a production capacity envelope.

### Candidate CI core and API overload

A 10k-history / 128-new-task run at 20 events/s passed independent ingestion, live and post-ingestion
browser journeys, query oracles, artifact measurement and restart validation. Its 240-request API
phase at 40 offered requests/s was **inconclusive**: 184 started requests succeeded, but 56 scheduled
requests hit the bounded 32-request concurrency limit and were dropped. Overall cost was 126.65 s.
This does not prove 40 requests/s capacity; the lower event rate did not resolve API offered-load
completion. The attempt remains preserved separately from subsequent core-profile candidates.

### Qualified core profile

The separately declared 10k-history core at 20 events/s and 12 API requests/s passed all 512 new
events, 240 scheduled HTTP/MCP requests, independent workflow/results/search checks, both production
browser journeys, artifact measurement and retained-data restart. No API arrivals were dropped.
The automatic main profile now uses these offered rates with 2 CPU / 2 GiB, indexing off, RocksDB
and the default 100-message notification buffer. This qualifies a regression workload, not maximum
capacity. The 40-requests/s attempt remains inconclusive evidence and 100/500-events/s profiles are
explicit manual stress cases; their known delivery limits are not declared resolved.

### Native registry-cold pod confirmation

The fresh-node native arm64 kind case passed after host-side Crane upload avoided Docker Desktop's
daemon-to-host-loopback routing limit. The application image and all 17 layer blobs were absent from
the node before pod creation (221,063,469 registry layer bytes). The initial container started at
3 s and real viewer-query readiness was observed at 5 s; full broker/task/event/workflow/result
validation completed 11.22 s after apply. The cached retained-store replacement started at 1 s,
reached query readiness at 5 s and validated all preserved data at 7.49 s. Production browser checks
passed. Cluster and private registry cleanup both passed.

Cluster setup took 26.19 s, dependency image import 2.73 s and private registry setup/native archive
upload 3.27 s. These are separate from pod startup. Kubernetes timestamps/probes have coarse
resolution; zero scheduling time means both timestamps fell in the same recorded second. This
measures local registry transfer/unpack, not Internet/cloud registry latency or cloud storage mounts.
Three incomplete registry setup attempts remain recorded; none supplies pod-start measurements.
Crane 0.22.1 came from its official checksum-verified native release. The measured dirty-image ID,
registry digest, pre-pod image/layer inventory and raw hashes are retained in the evidence summary.

### Debug-bundle replay correctness

Two production-image trials found a replay gap: the native debug export contained task/event/worker
records but omitted workflow summaries and memberships. Migration ran before import against an empty
store. Exact core payload comparison passed, while the independent workflow oracle failed.

New exports now preserve both workflow tables and replacement imports clear their stale graphs.
Legacy core-only bundles reconstruct derived workflows after import. The rebuilt image passed new
bundle replay (31,854 ZIP bytes, export 349 ms, replay through validation/browser 8.87 s) and a separate
older-source-image bundle. The stronger legacy oracle also passed all 160 memberships and 40 workflow
identities, exact core payloads, benchmark workflow summaries, read-only enforcement and the browser.
These are synthetic 128-history/32-new-task cases, not large-bundle startup capacity measurements.

### Deliberate runtime slowdown and calibration provenance

A temporary image variant delayed the executable Bun metrics method by 250 ms. The matched current
Docker 29.8.2 baseline/candidate both passed correctness. Metrics successful-response p95 rose from
7.62 to 259.41 ms and scheduled-to-complete p95 from 10.60 to 262.21 ms; the comparator flagged both
using provisional report-only budgets. Other flagged metrics remain unconfirmed noise, not additional
proven regressions. The earlier overlay changed an unused source file and is invalid slowdown proof;
its measurements remain preserved. No injected delay is present in repository runtime code.

Docker had updated from 29.8.1, so comparison with the earlier calibration was correctly incompatible.
Generated noise budgets now record series/trial provenance and reject use with a different workload,
harness, resource configuration or runner. Manual floors without provenance remain explicitly
unverified. A real CLI check rejected old-series noise budgets against the current matching pair;
this does not enable timing gates or promote local images into release references.

The final intentional omission trial also failed correctly: 127 of 128 raw events persisted while
browser convergence passed. Exact sequence coverage rejected the run and private cleanup passed.
Successful task results/rendering did not turn missing event history into a passing benchmark.

Legacy JSON replay had a second precision gap: JavaScript `Date` dropped sub-millisecond digits.
A unit regression test went red on `.123456789Z`; SDK `DateTime` made task, event and worker cases
pass. The final rebuilt native image also passed a generated legacy JSON bundle with exact core
payloads, all 160 memberships/40 workflows, independent benchmark history, read-only enforcement
and the browser journey. Native and legacy conversion/export timings remain separately labeled.
