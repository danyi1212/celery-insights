import logging
import os
import resource
import time

from prometheus_client import CollectorRegistry, Gauge, Histogram, generate_latest

from events.ingester import SurrealDBIngester
from metrics.queries import (
    query_exceptions_by_type,
    query_runtime_by_type,
    query_table_counts,
    query_task_counts_by_state,
    query_task_runtime_values,
    query_tasks_by_type,
    query_tasks_by_worker,
    query_worker_active_tasks,
    query_worker_counts,
    query_worker_processed_tasks,
)

logger = logging.getLogger(__name__)

RUNTIME_BUCKETS = (0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0, float("inf"))

_start_time = time.time()


def _populate_tier1_metrics(
    registry: CollectorRegistry,
    state_rows: list[dict],
    worker_rows: list[dict],
    runtimes: list[float],
) -> None:
    state_counts: dict[str, int] = {}
    total_tasks = 0
    for row in state_rows:
        state = row.get("state", "UNKNOWN")
        count = row.get("count", 0)
        state_counts[state] = count
        total_tasks += count

    total_workers = 0
    online_workers = 0
    offline_workers = 0
    for row in worker_rows:
        status = row.get("status", "")
        count = row.get("count", 0)
        total_workers += count
        if status == "online":
            online_workers = count
        elif status == "offline":
            offline_workers = count

    Gauge("celery_tasks_total", "Total number of tasks", registry=registry).set(total_tasks)

    tasks_by_state = Gauge("celery_tasks_by_state", "Tasks by state", ["state"], registry=registry)
    for state, count in sorted(state_counts.items()):
        tasks_by_state.labels(state=state).set(count)

    Gauge("celery_workers_total", "Total number of workers", registry=registry).set(total_workers)
    Gauge("celery_workers_online", "Number of online workers", registry=registry).set(online_workers)
    Gauge("celery_workers_offline", "Number of offline workers", registry=registry).set(offline_workers)

    runtime_hist = Histogram(
        "celery_task_runtime_seconds",
        "Task runtime duration in seconds",
        buckets=RUNTIME_BUCKETS,
        registry=registry,
    )
    for rt in runtimes:
        runtime_hist.observe(rt)

    Gauge("celery_tasks_succeeded_total", "Total succeeded tasks", registry=registry).set(
        state_counts.get("SUCCESS", 0)
    )
    Gauge("celery_tasks_failed_total", "Total failed tasks", registry=registry).set(state_counts.get("FAILURE", 0))
    Gauge("celery_tasks_retried_total", "Total retried tasks", registry=registry).set(state_counts.get("RETRY", 0))


async def collect_tier1() -> bytes:
    registry = CollectorRegistry(auto_describe=False)

    state_rows = await query_task_counts_by_state()
    worker_rows = await query_worker_counts()
    runtimes = await query_task_runtime_values()

    _populate_tier1_metrics(registry, state_rows, worker_rows, runtimes)

    return generate_latest(registry)


async def collect_tier2() -> bytes:
    registry = CollectorRegistry(auto_describe=False)

    state_rows = await query_task_counts_by_state()
    worker_rows = await query_worker_counts()
    runtimes = await query_task_runtime_values()
    type_rows = await query_tasks_by_type()
    worker_task_rows = await query_tasks_by_worker()
    runtime_type_rows = await query_runtime_by_type()
    exception_rows = await query_exceptions_by_type()
    active_rows = await query_worker_active_tasks()
    processed_rows = await query_worker_processed_tasks()

    _populate_tier1_metrics(registry, state_rows, worker_rows, runtimes)

    # celery_tasks_by_type
    tasks_by_type = Gauge("celery_tasks_by_type", "Tasks by task type", ["task_type"], registry=registry)
    for row in type_rows:
        tasks_by_type.labels(task_type=str(row.get("type", "unknown"))).set(row.get("count", 0))

    # celery_tasks_by_worker
    tasks_by_worker = Gauge("celery_tasks_by_worker", "Tasks by worker", ["worker"], registry=registry)
    for row in worker_task_rows:
        tasks_by_worker.labels(worker=str(row.get("worker", "unknown"))).set(row.get("count", 0))

    # celery_task_runtime_seconds_by_type
    type_runtimes: dict[str, list[float]] = {}
    for row in runtime_type_rows:
        t = str(row.get("type", "unknown"))
        rt = row.get("runtime")
        if isinstance(rt, int | float):
            type_runtimes.setdefault(t, []).append(rt)

    if type_runtimes:
        rt_by_type = Histogram(
            "celery_task_runtime_seconds_by_type",
            "Task runtime by type",
            labelnames=["task_type"],
            buckets=RUNTIME_BUCKETS,
            registry=registry,
        )
        for task_type, values in sorted(type_runtimes.items()):
            for rt in values:
                rt_by_type.labels(task_type=task_type).observe(rt)

    # celery_exceptions_by_type
    exceptions = Gauge("celery_exceptions_by_type", "Task exceptions by type", ["exception"], registry=registry)
    for row in exception_rows:
        exceptions.labels(exception=str(row.get("exception", "unknown"))).set(row.get("count", 0))

    # celery_worker_active_tasks
    worker_active = Gauge(
        "celery_worker_active_tasks", "Currently active tasks per worker", ["worker"], registry=registry
    )
    for row in active_rows:
        worker_active.labels(worker=str(row.get("worker", "unknown"))).set(row.get("count", 0))

    # celery_worker_processed_tasks
    worker_processed = Gauge(
        "celery_worker_processed_tasks", "Processed tasks per worker", ["worker"], registry=registry
    )
    for row in processed_rows:
        worker_processed.labels(worker=str(row.get("worker", "unknown"))).set(row.get("count", 0))

    return generate_latest(registry)


async def collect_tier3(ingester: SurrealDBIngester | None) -> bytes:
    registry = CollectorRegistry(auto_describe=False)

    Gauge("celery_insights_uptime_seconds", "Process uptime in seconds", registry=registry).set(
        time.time() - _start_time
    )

    try:
        load1, load5, load15 = os.getloadavg()
        cpu_load = Gauge("celery_insights_cpu_load", "System CPU load average", ["interval"], registry=registry)
        cpu_load.labels(interval="1m").set(load1)
        cpu_load.labels(interval="5m").set(load5)
        cpu_load.labels(interval="15m").set(load15)
    except OSError:
        pass

    rusage = resource.getrusage(resource.RUSAGE_SELF)
    Gauge("celery_insights_memory_rss_bytes", "Resident set size in bytes", registry=registry).set(rusage.ru_maxrss)

    if ingester:
        Gauge("celery_insights_events_ingested_total", "Total events ingested", registry=registry).set(
            ingester._stats_events_total
        )
        Gauge(
            "celery_insights_events_dropped_total", "Total events dropped due to backpressure", registry=registry
        ).set(ingester._dropped_count)
        Gauge("celery_insights_flushes_total", "Total flush operations", registry=registry).set(
            ingester._stats_flushes_total
        )
        Gauge("celery_insights_buffer_size", "Current ingester buffer size", registry=registry).set(
            len(ingester._buffer)
        )
        Gauge("celery_insights_queue_size", "Current event queue size", registry=registry).set(ingester.queue.qsize())

    table_counts = await query_table_counts()
    Gauge("celery_insights_db_tasks_count", "Number of task records in SurrealDB", registry=registry).set(
        table_counts["tasks"]
    )
    Gauge("celery_insights_db_workers_count", "Number of worker records in SurrealDB", registry=registry).set(
        table_counts["workers"]
    )
    Gauge("celery_insights_db_events_count", "Number of event records in SurrealDB", registry=registry).set(
        table_counts["events"]
    )

    return generate_latest(registry)
