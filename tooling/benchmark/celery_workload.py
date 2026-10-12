"""Real deterministic Celery work for paired monitoring-overhead measurements."""

import argparse
import asyncio
import json
import logging
import sys
import os
import threading
import time

from celery import Celery
from surrealdb import AsyncSurreal

from tooling.benchmark.pipeline import distribution, query, record_name

app = Celery("celery-benchmark", broker=os.environ["BROKER_URL"], backend=os.environ["RESULT_BACKEND"])
app.conf.update(
    task_track_started=True,
    task_send_sent_event=os.environ.get("BENCH_MONITORED") == "true",
    worker_send_task_events=os.environ.get("BENCH_MONITORED") == "true",
    result_backend_thread_safe=True,
    worker_prefetch_multiplier=1,
    control_queue_exclusive=True,
    event_queue_exclusive=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
)


@app.task(name="benchmark.cpu_work")
def cpu_work(index: int, iterations: int) -> int:
    return sum(value * value for value in range(iterations)) + index


async def measure(tasks: int, rate: int, iterations: int) -> dict:
    app.backend.client.ping()
    for _ in range(60):
        replies = await asyncio.to_thread(app.control.ping, timeout=1)
        if replies:
            break
        await asyncio.sleep(0.25)
    else:
        raise RuntimeError("Celery worker did not answer readiness ping")
    monitored = os.environ.get("BENCH_MONITORED") == "true"
    db = None
    if monitored:
        db = AsyncSurreal(os.environ["BENCH_DB_URL"])
        await db.signin(
            {
                "namespace": "celery_insights",
                "database": "main",
                "username": "ingester",
                "password": os.environ["BENCH_WRITER_PASSWORD"],
            }
        )
        await db.use("celery_insights", "main")
        # Worker polling must actually observe this worker before starting the workload.
        deadline = time.perf_counter() + 30
        while not await query(db, "SELECT id FROM worker WHERE status = 'online'"):
            if time.perf_counter() >= deadline:
                raise RuntimeError("Insights worker-poll readiness deadline exceeded")
            await asyncio.sleep(0.25)
    results = {}
    sent = {}
    lags = []
    errors = []
    completed = {}
    latencies = []
    published = threading.Event()
    stopped = threading.Event()
    start = time.perf_counter()

    def produce():
        try:
            for index in range(tasks):
                target = start + index / rate
                if stopped.wait(max(0, target - time.perf_counter())):
                    break
                sent[index] = time.perf_counter()
                lags.append((sent[index] - target) * 1000)
                results[index] = cpu_work.apply_async(
                    (index, iterations), task_id=f"celerybench-{index}", root_id=f"celerybench-{index}"
                )
        except Exception as error:
            logging.exception("Celery benchmark producer failed")
            errors.append(f"Producer: {type(error).__name__}: {error}")
        finally:
            published.set()

    producer = threading.Thread(target=produce, daemon=True)
    producer.start()
    persisted = None
    try:
        deadline = start + tasks / rate + 60
        while time.perf_counter() < deadline:
            for index, result in list(results.items()):
                if index in completed:
                    continue
                if await asyncio.to_thread(result.ready):
                    actual = await asyncio.to_thread(result.get, timeout=1)
                    expected = (iterations - 1) * iterations * (2 * iterations - 1) // 6 + index
                    if actual != expected:
                        errors.append(f"Task {index}: wrong deterministic result")
                    completed[index] = actual
                    latencies.append((time.perf_counter() - sent[index]) * 1000)
            if published.is_set() and len(completed) == tasks:
                break
            await asyncio.sleep(0.01)
        work_seconds = time.perf_counter() - start
        if len(completed) != tasks:
            errors.append(f"Completed {len(completed)}/{tasks} real tasks before deadline")
        if db:
            deadline = time.perf_counter() + 30
            while True:
                rows = await query(db, "SELECT * FROM task WHERE string::starts_with(record::id(id), 'celerybench-')")
                events = await query(
                    db, "SELECT task_id, event_type FROM event WHERE string::starts_with(task_id ?? '', 'celerybench-')"
                )
                workflows = await query(
                    db, "SELECT * FROM workflow WHERE string::starts_with(root_task_id, 'celerybench-')"
                )
                expected_ids = {f"celerybench-{index}" for index in range(tasks)}
                task_ok = {record_name(row["id"]) for row in rows} == expected_ids and all(
                    row.get("state") == "SUCCESS"
                    and row.get("result") == str(completed.get(int(record_name(row["id"]).split("-")[1])))
                    for row in rows
                )
                event_pairs = {(row["task_id"], row["event_type"]) for row in events}
                expected_pairs = {
                    (task_id, kind)
                    for task_id in expected_ids
                    for kind in ["task-sent", "task-received", "task-started", "task-succeeded"]
                }
                workflow_ok = {row["root_task_id"] for row in workflows} == expected_ids and all(
                    row.get("task_count") == 1 and row.get("aggregate_state") == "SUCCESS" for row in workflows
                )
                if task_ok and event_pairs == expected_pairs and len(events) == tasks * 4 and workflow_ok:
                    persisted = {"passed": True, "tasks": len(rows), "events": len(events), "workflows": len(workflows)}
                    break
                if time.perf_counter() >= deadline:
                    persisted = {
                        "passed": False,
                        "tasks": len(rows),
                        "events": len(events),
                        "workflows": len(workflows),
                        "taskResults": task_ok,
                        "eventCoverage": event_pairs == expected_pairs,
                        "workflowSummaries": workflow_ok,
                    }
                    errors.append("Insights persisted task/event/workflow validation failed")
                    break
                await asyncio.sleep(0.1)
        healthy = published.is_set() and len(results) == tasks and max(lags, default=0) < 100
        return {
            "status": "failed" if errors else "passed" if healthy else "inconclusive",
            "errors": errors,
            "monitored": monitored,
            "tasks": tasks,
            "offered_tasks_per_second": rate,
            "completed_tasks": len(completed),
            "work_seconds": work_seconds,
            "completed_task_goodput_per_second": len(completed) / work_seconds if not errors else None,
            "task_completion_ms": distribution(latencies),
            "publication_lag_ms": distribution(lags),
            "generator_healthy": healthy,
            "persisted": persisted,
            "limitations": [
                "Result completion is controller-observed via Redis polling, including observation overhead.",
                "Work and result STARTED writes match across modes; monitoring enables "
                "task-sent and worker lifecycle events.",
                "Insights validation/drain is after the worker completion window.",
            ],
        }
    finally:
        stopped.set()
        await asyncio.to_thread(producer.join, 10)
        if db:
            await db.close()
        app.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["worker", "measure"])
    parser.add_argument("--tasks", type=int, default=128)
    parser.add_argument("--rate", type=int, default=20)
    parser.add_argument("--iterations", type=int, default=250000)
    args = parser.parse_args()
    if min(args.tasks, args.rate, args.iterations) <= 0:
        parser.error("Task count, rate and iterations must be positive")
    if args.mode == "worker":
        app.worker_main(["worker", "--loglevel=WARNING", "--concurrency=2", "--hostname=benchmark-worker@%h"])
    else:
        result = asyncio.run(measure(args.tasks, args.rate, args.iterations))
        sys.stdout.write(json.dumps(result) + "\n")
        raise SystemExit(0 if result["status"] == "passed" else 1)
