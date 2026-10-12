"""Real broker ingestion with independent private database oracles and public typed refresh reads."""

import argparse
import asyncio
import json
import logging
import math
import os
import platform
import resource
import sys
import threading
import time
import base64

import websockets
from surrealdb.connections.async_ws import AsyncWsSurrealConnection
from collections import Counter
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from celery import Celery
from surrealdb import AsyncSurreal
from websockets.exceptions import ConnectionClosed
from websockets.typing import Origin, Subprotocol


def distribution(values: list[float]) -> dict[str, Any]:
    ordered = sorted(values)
    return {
        "samples": len(values),
        "p50": ordered[math.ceil(len(values) * 0.5) - 1] if values else None,
        "p95": ordered[math.ceil(len(values) * 0.95) - 1] if values else None,
        "p99": ordered[math.ceil(len(values) * 0.99) - 1] if len(values) >= 1000 else None,
        "max": ordered[-1] if values else None,
        "values": values,
    }


def scheduled_seconds(
    sequence: int, rate: int, burst_rate: int = 0, burst_seconds: int = 0, burst_at: int = 0
) -> float:
    """Piecewise fixed-arrival schedule, independent of response completion."""
    before = rate * burst_at
    during = burst_rate * burst_seconds
    if not burst_rate or sequence < before:
        return sequence / rate
    if sequence < before + during:
        return burst_at + (sequence - before) / burst_rate
    return burst_at + burst_seconds + (sequence - before - during) / rate


async def query(db: Any, sql: str, bindings: dict | None = None) -> Any:
    response = await db.query_raw(sql, bindings or {})
    if "error" in response:
        raise RuntimeError(str(response["error"]))
    rows = response.get("result", [])
    errors = [row["result"] for row in rows if row.get("status") == "ERR"]
    if errors:
        raise RuntimeError(str(errors))
    return rows[-1]["result"] if rows else []


class PublicObservation(AsyncWsSurrealConnection):
    async def connect(self, url=None):
        if url is not None and url != self.raw_url:
            raise ValueError("Public endpoint is fixed for this connection")
        if self.socket is not None:
            return
        self.socket = await websockets.connect(
            self.raw_url,
            subprotocols=[Subprotocol("cbor")],
            max_size=16 * 1024 * 1024,
            origin=Origin(os.environ["BENCH_AUTH_ORIGIN"]),
            additional_headers={
                "Authorization": "Basic " + base64.b64encode(b"benchmark:synthetic-benchmark-password").decode()
            },
        )
        self.loop = asyncio.get_running_loop()
        self.recv_task = asyncio.create_task(self._recv_task())


async def public_subscription(db: Any, table: str):
    subscription = await query(db, f"LIVE SELECT * FROM {table}")
    return await db.subscribe_live(subscription)


async def public_rows(db: Any, table: str, search: str = "bench-", since: datetime | None = None) -> list[dict]:
    """Use the public request contract, without SQL, namespace or database credentials."""
    rows = []
    window = (
        {"from": since.astimezone(UTC).isoformat().replace("+00:00", "Z"), "to": "9999-12-31T23:59:59Z"}
        if since
        else {}
    )
    while True:
        page = await query(
            db,
            "observation:read",
            {
                "request": {
                    "operation": "list",
                    **window,
                    "table": table,
                    "query": search,
                    "limit": 1000,
                    "offset": len(rows),
                }
            },
        )
        rows.extend(page)
        if len(page) < 1000:
            return rows


class PublicSnapshot:
    """Bound repeated reads; an unconditional final snapshot catches older/out-of-order records."""

    def __init__(self, table: str):
        self.table = table
        self.cursor: datetime | None = None
        self.returned_rows = 0
        self.reads = 0
        self.reconciled = False

    async def read(self, db: Any, *, complete: bool = False) -> list[dict]:
        full = complete and not self.reconciled
        rows = await public_rows(
            db, self.table, since=None if full or self.cursor is None else self.cursor - timedelta(seconds=1)
        )
        self.reads += 1
        self.returned_rows += len(rows)
        field = "timestamp" if self.table == "event" else "last_updated"
        for row in rows:
            timestamp = row[field]
            if not isinstance(timestamp, datetime):
                timestamp = datetime.fromisoformat(str(timestamp))
            if timestamp.tzinfo is None:
                raise ValueError("Public snapshot timestamp must have a timezone")
            self.cursor = max(self.cursor, timestamp) if self.cursor else timestamp
        if full:
            self.reconciled = True
        return rows


def record_name(value: Any) -> str:
    return str(value).split(":", 1)[-1].strip("⟨⟩<>'\"")


def validate(tasks: list[dict], events: list[dict], workflows: list[dict], task_count: int, payload: int) -> list[str]:
    """Expected literals come from the fixture contract, independently of production query builders."""
    problems = []
    by_id = {record_name(task["id"]): task for task in tasks}
    expected_ids = {f"bench-{index}" for index in range(task_count)}
    if set(by_id) != expected_ids:
        problems.append(f"Task IDs differ: expected {task_count}, received {len(by_id)}")
    for index in range(task_count):
        task = by_id.get(f"bench-{index}", {})
        expected_result = repr(f"benchmark-result-{index}" + "x" * payload)[:102400]
        expected_workflow = f"bench-{index // 4 * 4}"
        if task.get("state") != "SUCCESS" or task.get("result") != expected_result:
            problems.append(f"bench-{index}: incorrect state/result")
        if task.get("workflow_id") != expected_workflow:
            problems.append(f"bench-{index}: incorrect workflow")
        if task.get("result_truncated") != (len(repr(f"benchmark-result-{index}" + "x" * payload)) > 102400):
            problems.append(f"bench-{index}: incorrect result truncation flag")
    sequences = Counter(json.loads(event["data"]).get("bench_sequence") for event in events)
    if sequences != Counter(range(task_count * 4)):
        problems.append(f"Raw event coverage differs: expected {task_count * 4}, received {len(events)}")
    by_root = {record_name(workflow["id"]): workflow for workflow in workflows}
    expected_roots = {f"bench-{index}" for index in range(0, task_count, 4)}
    if set(by_root) != expected_roots:
        problems.append("Workflow IDs differ")
    for index in range(0, task_count, 4):
        workflow = by_root.get(f"bench-{index}", {})
        if workflow.get("task_count") != min(4, task_count - index) or workflow.get("aggregate_state") != "SUCCESS":
            problems.append(f"bench-{index}: incorrect workflow summary")
    return problems


async def validate_existing(args: argparse.Namespace) -> dict:
    """Recheck retained data after restart without publishing or refreshing Redis keys."""
    started = time.perf_counter()
    failures = []
    deadline = started + args.drain_seconds
    while True:
        db = AsyncSurreal(os.environ["BENCH_DB_URL"])
        try:

            async def inspect(db=db):
                await db.signin(
                    {
                        "namespace": "celery_insights",
                        "database": "main",
                        "username": "ingester",
                        "password": os.environ["BENCH_WRITER_PASSWORD"],
                    }
                )
                await db.use("celery_insights", "main")
                tasks = await query(db, "SELECT * FROM task WHERE string::starts_with(record::id(id), 'bench-')")
                events = await query(db, "SELECT data FROM event WHERE string::starts_with(task_id ?? '', 'bench-')")
                workflows = await query(db, "SELECT * FROM workflow WHERE string::starts_with(root_task_id, 'bench-')")
                return tasks, events, workflows

            tasks, events, workflows = await asyncio.wait_for(
                inspect(), timeout=max(0.01, deadline - time.perf_counter())
            )
            errors = validate(tasks, events, workflows, args.tasks, args.result_bytes)
            if errors:
                raise RuntimeError("; ".join(errors[:10]))
            return {
                "status": "passed",
                "tasks": len(tasks),
                "events": len(events),
                "workflows": len(workflows),
                "validatedDataMs": (time.perf_counter() - started) * 1000,
                "retries": len(failures),
                "errors": failures[-20:],
            }
        except (ConnectionClosed, TimeoutError, RuntimeError, KeyError, OSError, ValueError) as error:
            failures.append(f"{type(error).__name__}: {error}")
            if time.perf_counter() >= deadline:
                return {"status": "failed", "validatedDataMs": None, "retries": len(failures), "errors": failures[-20:]}
            await asyncio.sleep(0.1)
        finally:
            await db.close()


async def run(args: argparse.Namespace) -> dict:
    app = Celery("benchmark", broker=os.environ["BROKER_URL"], backend=os.environ["RESULT_BACKEND"])
    app.conf.result_backend_thread_safe = True
    # Establish backend connections outside the timed window without creating a task result to backfill.
    await asyncio.to_thread(app.backend.client.ping)
    db = AsyncSurreal(os.environ["BENCH_DB_URL"])
    task_ids = [f"bench-{index}" for index in range(args.tasks)]
    await db.signin(
        {
            "namespace": "celery_insights",
            "database": "main",
            "username": "ingester",
            "password": os.environ["BENCH_WRITER_PASSWORD"],
        }
    )
    await db.use("celery_insights", "main")
    validation_db = AsyncSurreal(os.environ["BENCH_DB_URL"])
    await validation_db.signin(
        {
            "namespace": "celery_insights",
            "database": "main",
            "username": "ingester",
            "password": os.environ["BENCH_WRITER_PASSWORD"],
        }
    )
    await validation_db.use("celery_insights", "main")
    public_db = PublicObservation(os.environ["BENCH_PUBLIC_URL"])
    public_stream = await public_subscription(public_db, "task")
    public_event_seen: dict[int, float] = {}
    public_result_seen: dict[str, float] = {}
    reader_db = public_db
    if args.reader_mode == "separate":
        reader_db = PublicObservation(os.environ["BENCH_PUBLIC_URL"])
    emitted: dict[str, float] = {}
    event_emitted: dict[int, float] = {}
    event_seen: dict[int, float] = {}
    terminal_seen: dict[str, float] = {}
    result_seen: dict[str, float] = {}
    notification_bytes = []
    query_times: list[float] = []
    publication_lag: list[float] = []
    errors: list[str] = []
    published = 0
    publication_finished_at = None
    finished = threading.Event()
    stop = threading.Event()
    live_id = await db.live("task")
    stream = await db.subscribe_live(live_id)
    event_live_id = await db.live("event")
    event_stream = await db.subscribe_live(event_live_id)
    fanout_connections = []
    fanout_streams = []
    fanout_seen: list[dict[int, float]] = []
    public_task_snapshot = PublicSnapshot("task")
    public_event_snapshot = PublicSnapshot("event")
    fanout_snapshots: list[PublicSnapshot] = []
    for _ in range(args.live_clients - 1):
        client = PublicObservation(os.environ["BENCH_PUBLIC_URL"])
        fanout_streams.append(await public_subscription(client, "event"))
        fanout_connections.append(client)
        fanout_seen.append({})
        fanout_snapshots.append(PublicSnapshot("event"))

    async def observe_fanout(index: int) -> None:
        delay_ms = args.slow_client_delay_ms if index == len(fanout_streams) - 1 else 0
        async for refresh in fanout_streams[index]:
            if not refresh.get("__observation_refresh"):
                raise RuntimeError("Public subscription did not emit a refresh marker")
            if delay_ms:
                await asyncio.sleep(delay_ms / 1000)
            for row in await fanout_snapshots[index].read(
                fanout_connections[index], complete=finished.is_set() and all_events_observed_at is not None
            ):
                sequence = json.loads(row["data"]).get("bench_sequence")
                if sequence in event_emitted:
                    fanout_seen[index].setdefault(sequence, (time.perf_counter() - event_emitted[sequence]) * 1000)

    async def observe_public() -> None:
        async for refresh in public_stream:
            if not refresh.get("__observation_refresh"):
                raise RuntimeError("Public subscription did not emit a refresh marker")
            for row in await public_task_snapshot.read(
                public_db, complete=finished.is_set() and all_events_observed_at is not None
            ):
                task_id = record_name(row["id"])
                if task_id in emitted and row.get("state") == "SUCCESS" and row.get("result") is not None:
                    index = int(task_id.removeprefix("bench-"))
                    expected = repr(f"benchmark-result-{index}" + "x" * args.result_bytes)[:102400]
                    if row["result"] != expected or row.get("workflow_id") != f"bench-{index // 4 * 4}":
                        raise RuntimeError(f"Public task payload differs: {task_id}")
                    public_result_seen.setdefault(task_id, (time.perf_counter() - emitted[task_id]) * 1000)
            for row in await public_event_snapshot.read(
                public_db, complete=finished.is_set() and all_events_observed_at is not None
            ):
                sequence = json.loads(row["data"]).get("bench_sequence")
                if sequence in event_emitted:
                    public_event_seen.setdefault(sequence, (time.perf_counter() - event_emitted[sequence]) * 1000)

    async def observe_events() -> None:
        async for row in event_stream:
            data = row.get("data")
            if not isinstance(data, str):
                raise RuntimeError("Raw-event notification has no JSON data string")
            event = json.loads(data)
            sequence = event.get("bench_sequence")
            if sequence in event_emitted:
                event_seen.setdefault(sequence, (time.perf_counter() - event_emitted[sequence]) * 1000)

    async def observe() -> None:
        async for row in stream:
            now = time.perf_counter()
            task_id = record_name(row["id"])
            notification_bytes.append(len(json.dumps(row, default=str).encode()))
            if task_id in emitted and row.get("state") == "SUCCESS":
                terminal_seen.setdefault(task_id, (now - emitted[task_id]) * 1000)
                if row.get("result") is not None:
                    result_seen.setdefault(task_id, (now - emitted[task_id]) * 1000)

    async def read() -> None:
        while True:
            started = time.perf_counter()
            await query(reader_db, "observation:read", {"request": {"operation": "list", "table": "task", "limit": 50}})
            query_times.append((time.perf_counter() - started) * 1000)
            await asyncio.sleep(0.1)

    # A real probe proves consumer subscription readiness; process presence is insufficient.
    with app.connection() as connection:
        dispatcher = app.events.Dispatcher(connection, hostname="benchmark-probe")
        for _attempt in range(100):
            await asyncio.to_thread(dispatcher.send, "worker-heartbeat", bench_probe=True)
            rows = await query(db, "SELECT * FROM worker WHERE id = worker:`benchmark-probe`")
            if rows:
                break
            await asyncio.sleep(0.1)
        else:
            raise RuntimeError("Receiver never committed readiness probe")

    private_workers = [asyncio.create_task(observe()), asyncio.create_task(observe_events())]
    private_errors: list[str] = []
    workers = [asyncio.create_task(observe_public())]
    workers.extend(asyncio.create_task(observe_fanout(index)) for index in range(len(fanout_streams)))
    if args.reader_mode != "none":
        workers.append(asyncio.create_task(read()))
    start = time.perf_counter()

    def produce() -> None:
        nonlocal published, publication_finished_at
        sequence = 0
        try:
            with app.connection() as connection:
                dispatcher = app.events.Dispatcher(connection, hostname="benchmark-worker")
                # Interleaved batches exercise periodic and terminal flushes, not just serial completions.
                for base in range(0, args.tasks, 32):
                    for kind in ["task-sent", "task-received", "task-started", "task-succeeded"]:
                        for index in range(base, min(base + 32, args.tasks)):
                            scheduled = scheduled_seconds(
                                sequence, args.rate, args.burst_rate, args.burst_seconds, args.burst_at_seconds
                            )
                            if stop.wait(max(0, start + scheduled - time.perf_counter())):
                                return
                            task_id = f"bench-{index}"
                            if kind == "task-succeeded":
                                app.backend.store_result(
                                    task_id, f"benchmark-result-{index}" + "x" * args.result_bytes, "SUCCESS"
                                )
                                emitted[task_id] = time.perf_counter()
                            publication_lag.append(max(0, time.perf_counter() - start - scheduled) * 1000)
                            if sequence != args.drop_sequence:
                                event_emitted[sequence] = time.perf_counter()
                                dispatcher.send(
                                    kind,
                                    uuid=task_id,
                                    name="benchmark.work",
                                    args="()",
                                    kwargs=repr({"organization_id": index % 11}),
                                    root_id=f"bench-{index // 4 * 4}",
                                    parent_id=f"bench-{index // 4 * 4}" if index % 4 else None,
                                    bench_sequence=sequence,
                                )
                                published += 1
                            sequence += 1
        except Exception as error:
            logging.exception("Benchmark producer failed")
            errors.append(f"Producer: {error}")
        finally:
            publication_finished_at = time.perf_counter()
            finished.set()

    producer = threading.Thread(target=produce, daemon=True)
    producer.start()
    all_events_observed_at = None
    observer_failed = False
    planned_seconds = scheduled_seconds(
        args.tasks * 4, args.rate, args.burst_rate, args.burst_seconds, args.burst_at_seconds
    )
    deadline = start + planned_seconds + args.drain_seconds
    try:
        while time.perf_counter() < deadline:
            for worker in private_workers:
                if worker.done() and not worker.cancelled():
                    failure = worker.exception()
                    private_errors.append(
                        f"{type(failure).__name__}: {failure}" if failure else "Native observer stopped"
                    )
            private_workers = [worker for worker in private_workers if not worker.done()]
            if not observer_failed:
                for worker in workers:
                    if worker.done():
                        failure = worker.exception()
                        errors.append(
                            f"Observer: {type(failure).__name__}: {failure}" if failure else "Observer stopped"
                        )
                        observer_failed = True
                if observer_failed:
                    for worker in workers:
                        worker.cancel()
                    await asyncio.gather(*workers, return_exceptions=True)
            live_complete = (
                len(public_result_seen) == args.tasks
                and len(public_event_seen) == published
                and all(len(seen) == published for seen in fanout_seen)
                and public_task_snapshot.reconciled
                and public_event_snapshot.reconciled
                and all(snapshot.reconciled for snapshot in fanout_snapshots)
            )
            if finished.is_set():
                if all_events_observed_at is None:
                    counts = await query(
                        validation_db,
                        "SELECT count() AS count FROM event WHERE task_id IN $ids GROUP ALL",
                        {"ids": task_ids},
                    )
                    if counts and counts[0]["count"] >= published:
                        all_events_observed_at = time.perf_counter()
                if all_events_observed_at is not None and (live_complete or observer_failed):
                    break
            await asyncio.sleep(0.05)
        if not finished.is_set():
            errors.append("Deadline exceeded before event publication completed")
        if all_events_observed_at is None:
            errors.append(
                "Deadline exceeded before raw-event drain was measured; final persistence is checked separately"
            )
        if not live_complete:
            # SDK LIVE iterators may wait forever after transport closure. An end-of-window
            # probe classifies that failure without adding traffic to the measured interval.
            try:
                await asyncio.wait_for(public_rows(public_db, "task"), timeout=2)
            except (ConnectionClosed, TimeoutError, RuntimeError, KeyError) as failure:
                errors.append(f"Observer connection probe: {type(failure).__name__}: {failure}")
            errors.append(
                f"LIVE delivery incomplete: {len(public_event_seen)}/{published} events and "
                f"{len(public_result_seen)}/{args.tasks} expected results observed"
            )
            for index, seen in enumerate(fanout_seen):
                if len(seen) != published:
                    errors.append(f"Fan-out client {index + 2}: {len(seen)}/{published} raw events observed")
        elapsed = time.perf_counter() - start
        tasks = await query(validation_db, "SELECT * FROM task WHERE string::starts_with(record::id(id), 'bench-')")
        events = await query(validation_db, "SELECT data FROM event WHERE string::starts_with(task_id ?? '', 'bench-')")
        workflows = await query(
            validation_db, "SELECT * FROM workflow WHERE string::starts_with(root_task_id, 'bench-')"
        )
        correctness_errors = validate(tasks, events, workflows, args.tasks, args.result_bytes)
        errors.extend(correctness_errors)
        generator_healthy = (
            finished.is_set()
            and not any(error.startswith("Producer:") for error in errors)
            and max(publication_lag, default=0) < 100
        )
        return {
            "status": "failed" if errors else "passed" if generator_healthy else "inconclusive",
            "errors": errors,
            "fixture": {"version": 1, "tasks": args.tasks, "events": args.tasks * 4, "result_bytes": args.result_bytes},
            "offered_events_per_second": args.rate,
            "arrival_schedule": {
                "steady_rate": args.rate,
                "burst_rate": args.burst_rate,
                "burst_seconds": args.burst_seconds,
                "burst_at_seconds": args.burst_at_seconds,
                "planned_seconds": planned_seconds,
            },
            "publication_seconds": publication_finished_at - start if publication_finished_at is not None else None,
            "published_events_per_second": published / (publication_finished_at - start)
            if publication_finished_at is not None and publication_finished_at > start
            else None,
            "validated_event_goodput_per_second": len(events) / (all_events_observed_at - start)
            if not correctness_errors and all_events_observed_at is not None and all_events_observed_at > start
            else None,
            "public_convergence_seconds": elapsed,
            "reader_mode": args.reader_mode,
            "published_events": published,
            "validated_events": len(events) if not correctness_errors else None,
            "persisted_correctness": {"passed": not correctness_errors, "errors": correctness_errors},
            "live_delivery_complete": live_complete,
            "raw_event_drain_observed": all_events_observed_at is not None,
            "elapsed_seconds": elapsed,
            "drain_seconds": max(0, all_events_observed_at - publication_finished_at)
            if all_events_observed_at is not None and publication_finished_at is not None
            else None,
            "publication_lag_ms": distribution(publication_lag),
            "terminal_to_live_ms": distribution(list(terminal_seen.values())),
            "publication_to_raw_event_live_ms": distribution(list(event_seen.values())),
            "terminal_to_result_live_ms": distribution(list(result_seen.values())),
            "viewer_query_ms": distribution(query_times),
            "measurement_contract": "typed-refresh-v2",
            "private_live": {
                "complete": len(event_seen) == published and len(result_seen) == args.tasks and not private_errors,
                "diagnostic_only": True,
                "events": len(event_seen),
                "results": len(result_seen),
                "errors": private_errors,
            },
            "public_refresh": {
                "cadence_ms": 5000,
                "strategy": "timestamp-window-with-final-snapshot",
                "returned_rows": public_task_snapshot.returned_rows + public_event_snapshot.returned_rows,
                "snapshot_reads": public_task_snapshot.reads + public_event_snapshot.reads,
                "full_reconciliation": public_task_snapshot.reconciled and public_event_snapshot.reconciled,
                "publication_to_raw_event_ms": distribution(list(public_event_seen.values())),
                "terminal_to_result_ms": distribution(list(public_result_seen.values())),
                "events": len(public_event_seen),
                "results": len(public_result_seen),
                "complete": live_complete,
            },
            "live_notifications": len(notification_bytes),
            "live_bytes": sum(notification_bytes),
            "fanout": {
                "clients": args.live_clients,
                "slow_client_delay_ms": args.slow_client_delay_ms,
                "observations": [
                    {"client": 1, "raw_events": len(public_event_seen), "delay_ms": 0},
                    *[
                        {
                            "client": index + 2,
                            "raw_events": len(seen),
                            "delay_ms": args.slow_client_delay_ms if index == len(fanout_seen) - 1 else 0,
                            "publication_to_raw_event_live_ms": distribution(list(seen.values())),
                        }
                        for index, seen in enumerate(fanout_seen)
                    ],
                ],
                "limitations": [
                    "Public refresh clients refetch raw events; the primary client also refetches task results.",
                    "Slow-client delay paces iterator consumption; SDK/socket buffers may continue reading.",
                    "Protocol clients share the generator process; this is not multiple rendered browsers.",
                ],
            },
            "generator_healthy": generator_healthy,
            "limitations": [
                "Public freshness includes the 5-second refresh cadence and authorized typed reads.",
                "Unprefixed LIVE latency metrics observe the private native database, not the public API. "
                "Native LIVE completeness is diagnostic; public refresh and exact persisted oracles "
                "determine correctness.",
                "Fixed 100ms query pacing is a background reader, not a query capacity measurement.",
                "Private raw-event drain polls at 50ms after publication, independently of public refresh. "
                "Goodput divides validated events by publication-to-durable-count time. "
                "Drain polling yields a timing upper bound and excludes public refresh.",
                "On delivery failure, latency distributions describe successful partial observations only; "
                "they cannot establish tail latency.",
            ],
        }
    finally:
        stop.set()
        await asyncio.to_thread(producer.join, 10)
        for worker in workers + private_workers:
            worker.cancel()
        await asyncio.gather(*workers, *private_workers, return_exceptions=True)
        await db.close()
        if reader_db is not public_db:
            await reader_db.close()
        await public_db.close()
        await validation_db.close()
        for client in fanout_connections:
            await client.close()
        app.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--tasks", type=int, default=256)
    parser.add_argument("--rate", type=int, default=100)
    parser.add_argument("--reader-mode", choices=["shared", "separate", "none"], default="shared")
    parser.add_argument("--live-clients", type=int, default=1)
    parser.add_argument("--slow-client-delay-ms", type=int, default=0)
    parser.add_argument("--result-bytes", type=int, default=0)
    parser.add_argument("--drain-seconds", type=float, default=30)
    parser.add_argument("--drop-sequence", type=int, default=-1)
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--burst-rate", type=int, default=0)
    parser.add_argument("--burst-seconds", type=int, default=0)
    parser.add_argument("--burst-at-seconds", type=int, default=0)
    arguments = parser.parse_args()
    if arguments.tasks <= 0 or arguments.rate <= 0 or arguments.drain_seconds <= 0 or arguments.result_bytes < 0:
        parser.error("tasks, rate and drain must be positive; payload must be nonnegative")
    if not 1 <= arguments.live_clients <= 16 or not 0 <= arguments.slow_client_delay_ms <= 1000:
        parser.error("live clients must be 1..16 and slow-client delay 0..1000 ms")
    if arguments.slow_client_delay_ms and arguments.live_clients < 2:
        parser.error("slow-client delay requires at least two live clients")
    if arguments.burst_rate and (
        arguments.burst_rate < arguments.rate or arguments.burst_seconds <= 0 or arguments.burst_at_seconds < 0
    ):
        parser.error("burst must have rate >= steady rate, positive duration and nonnegative start")
    if not arguments.burst_rate and (arguments.burst_seconds or arguments.burst_at_seconds):
        parser.error("burst parameters require a burst rate")
    if (
        arguments.burst_rate
        and arguments.tasks * 4
        <= arguments.rate * arguments.burst_at_seconds + arguments.burst_rate * arguments.burst_seconds
    ):
        parser.error("workload must include the complete burst and a recovery period")
    report: dict[str, Any]
    try:
        resource_started = time.perf_counter()
        usage_before = resource.getrusage(resource.RUSAGE_SELF)
        report = asyncio.run(validate_existing(arguments) if arguments.validate_only else run(arguments))
    except Exception as error:
        logging.exception("Benchmark scenario failed")
        report = {"status": "failed", "errors": [f"{type(error).__name__}: {error}"]}
    usage_after = resource.getrusage(resource.RUSAGE_SELF)
    resource_seconds = time.perf_counter() - resource_started
    cpu_seconds = usage_after.ru_utime + usage_after.ru_stime - usage_before.ru_utime - usage_before.ru_stime
    counters = {}
    for name in ["cpu.max", "memory.max", "memory.peak"]:
        try:
            counters[name] = Path("/sys/fs/cgroup", name).read_text().strip()
        except OSError:
            counters[name] = None
    report["generator_resources"] = {
        "elapsed_seconds": resource_seconds,
        "cpu_seconds": cpu_seconds,
        "average_cpu_cores": cpu_seconds / resource_seconds if resource_seconds > 0 else None,
        "process_peak_rss_bytes": usage_after.ru_maxrss * (1 if platform.system() == "Darwin" else 1024),
        "container_limits_and_peak": counters,
        "limitations": [
            "Generator and observer share this process, including readiness, workload, validation and cleanup.",
            "RSS/cgroup peaks are cumulative since startup; not publication-only or additive app memory.",
            "Publisher lag detects unsustainable arrivals; resource averages alone do not prove headroom.",
        ],
    }
    sys.stdout.write(json.dumps(report, default=str) + "\n")
    raise SystemExit(0 if report["status"] == "passed" else 1)
