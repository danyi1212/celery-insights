# Measured resource guidance

For a small installation, **start with 1 CPU and 1 GiB for the Celery Insights app**,
then run the benchmark against your payloads and retention settings. This is a preliminary
starting allocation supported by the bounded workload below. Broker, result backend,
Kubernetes node and benchmark generator resources are additional.

The local 15-minute run passed independent event, task, result and workflow checks,
complete LIVE delivery, production-browser convergence and validation after an orderly restart.
It started with 1,000 historical tasks and ended with 5,600 retained tasks / 22,400 task events.
Arrivals were 20 events/s, with a five-second 100-events/s burst at minute five. Search indexing
was disabled; storage was RocksDB; historical successful results were padded to 256 bytes.
One browser and one protocol observer were active. The observer also queried every 100 ms.

| Observation                               |         Measured value |
| ----------------------------------------- | ---------------------: |
| Validated new events                      |        18,400 / 18,400 |
| Raw-event LIVE p95 / maximum              |      333 ms / 1,105 ms |
| Terminal-result LIVE p95                  |                 120 ms |
| CPU after the first 30 seconds            |     0.53 cores average |
| Cumulative container memory peak          |                621 MiB |
| Sampled container memory peak             |                576 MiB |
| Allocated data-store bytes after shutdown | 119,463,936 (~114 MiB) |
| Restart to full persisted-data validation |                16.77 s |
| Retried flush conflicts                   |      17, all recovered |

The 1 GiB limit left about 403 MiB above the observed cumulative peak. CPU averages hide bursts:
2,320 of 8,575 steady-observation scheduling periods were throttled. Restart timing includes
container control, readiness retries and full validation; it is not a health-probe-only startup time.
A separate five-minute 20-events/s run also passed at 1 CPU / 1 GiB, with a 392 MiB cumulative peak.

These measurements came from arm64 Docker Desktop on an Apple M3 Pro. The source was a dirty
development checkout and the measured image had no OCI revision label. They support a local sizing
example, not an approved main-branch baseline or a production capacity guarantee. The immutable
image ID, workload, hardware/runtime metadata and raw-result checksums are retained in
[the evidence summary](benchmark-evidence-2026-10-11.json).

Keep retention bounded and monitor memory, storage and freshness. Memory grew while retained data
grew: the measured total-memory slope was about 332 KB/s, including cache. That is neither a leak
diagnosis nor evidence that 1 GiB supports indefinite retention. Large results, enabled indexing,
many browsers/workers, high API traffic and larger retained datasets need their own measurements.
The 100-events/s mixed profile on 10,000 historical tasks failed LIVE delivery at 2 CPU / 2 GiB;
adding resources alone is not an established remedy. See [calibration findings](benchmark-calibration.md).

Reproduce the bounded run with a current source-built image:

```shell
bun run bench suite --manifest tooling/benchmark/suites/soak.json --image <image> --output <new-directory>
bun run bench suite --manifest tooling/benchmark/suites/resources.json --image <image> --output <new-directory>
```

The resource sweep presets are test points, not additional recommendations until their results pass
correctness and are reviewed. Choose higher allocations from measured resource/freshness curves;
do not infer sustainable throughput from a short successful burst or a single idle snapshot.
