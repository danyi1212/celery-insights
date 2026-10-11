# Search index validation — 2026-10-10

Native SurrealDB 3.3.0 on Apple Silicon. Both modes use the same task/workflow schema, receiver callback, ingester consume loop, workflow/raw-event writes, actual Celery cache result backend, result updates, task LIVE subscription and concurrent selective searches. Each workload offers events for two seconds. Backend reads add 2 ms of simulated latency; no broker or Redis capacity is measured. The ingester's existing periodic-flush overlap race is excluded by using its serial terminal-event flush path. No ingestion production behavior is changed by the harness.

Reproduce with the SurrealDB 3.3+ CLI on PATH:

```shell
SEARCH_BENCHMARK_OUTPUT=/tmp/search-index-workloads.jsonl uv run pytest server/events/search_indexing_integration_test.py --log-cli-level=INFO
```

All twelve comparisons persisted every event and result with no dropped events. Large-payload cases use 16 KiB args and 100 KiB backend results. Derived search data never appeared in task LIVE payloads; notification counts and average payload sizes were identical between modes.

| Storage | Events/sec | Result bytes | Indexing | Elapsed (s) | Pending at input stop | Task LIVE p95 (ms) | Search p95 (ms) | Mean task LIVE bytes |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| rocksdb | 100 | 0 | off | 2.012 | 0 | 41.23 | 2.14 | 535 |
| rocksdb | 100 | 0 | on | 2.017 | 4 | 43.38 | 1.47 | 535 |
| surrealkv | 100 | 0 | off | 2.012 | 0 | 45.42 | 2.36 | 535 |
| surrealkv | 100 | 0 | on | 2.016 | 0 | 46.42 | 1.47 | 535 |
| rocksdb | 500 | 0 | off | 2.396 | 152 | 360.53 | 4.41 | 537 |
| rocksdb | 500 | 0 | on | 3.153 | 348 | 1068.01 | 2.03 | 537 |
| surrealkv | 500 | 0 | off | 4.103 | 504 | 2003.57 | 4.28 | 537 |
| surrealkv | 500 | 0 | on | 4.456 | 540 | 2327.46 | 2.1 | 537 |
| rocksdb | 100 | 102400 | off | 2.016 | 0 | 42.46 | 3.38 | 16921 |
| rocksdb | 100 | 102400 | on | 2.012 | 0 | 45.08 | 2.82 | 16921 |
| surrealkv | 100 | 102400 | off | 2.017 | 4 | 45.01 | 3.48 | 16921 |
| surrealkv | 100 | 102400 | on | 2.038 | 0 | 47.98 | 3.29 | 16921 |

Indexing is opt-in: selective reads improved in these small samples, while 500 events/sec increased ingestion latency. Common queries and records requiring fallback benefit less. Timings vary with filesystem cache, machine load, grouping, backend latency and payload contents; these short runs are not production throughput limits.

The regression suites additionally run all 87 task and six workflow fixtures against the same production projection schema in disabled, enabled, building and missing-index modes on disk. They cover key/value types, nested values and ordering, 64-bit precision, strings/escapes, malformed kwargs, state-only updates, stale event protection, result metadata, large text tails, deletion, shared-database configuration conflicts and disable/reenable. The actual WASM engine exercises demo fallback. Native migration checks verify backfill without derived fields in task records.
