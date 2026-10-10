"""Disk-backed receiver → ingester → result-backend → LIVE workloads with concurrent searches.

SEARCH_BENCHMARK_OUTPUT optionally saves measurements as JSONL. These comparisons exercise the real
Celery cache result backend with 2 ms simulated read latency; they do not measure Redis or broker capacity.
"""

import asyncio
import json
import logging
import math
import os
import shutil
import socket
import subprocess
import time
from pathlib import Path
from threading import Thread
from typing import Any

import httpx
import pytest
from celery import Celery
from surrealdb import AsyncSurreal

from events.ingester import SurrealDBIngester
from events.receiver import CeleryEventReceiver
from surrealdb_test_helpers import _extract_id, _query_last
from tasks.task_search import build_indexed_task_search
from tasks.result_fetcher import ResultFetcher

logger = logging.getLogger(__name__)
PROJECT = Path(__file__).resolve().parents[2]


def percentile(values: list[float]) -> float:
    return round(sorted(values)[max(0, math.ceil(len(values) * 0.95) - 1)], 2) if values else 0


@pytest.mark.skipif(shutil.which("surreal") is None, reason="SurrealDB 3.3+ CLI required")
@pytest.mark.parametrize("enabled", [False, True])
@pytest.mark.parametrize("storage", ["rocksdb", "surrealkv"])
@pytest.mark.parametrize(("rate", "payload_size"), [(100, 0), (500, 0), (100, 100 * 1024)])
@pytest.mark.asyncio
async def test_search_during_disk_ingestion(
    tmp_path: Path, mocker: Any, *, enabled: bool, storage: str, rate: int, payload_size: int
) -> None:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    process = subprocess.Popen(
        [
            "surreal",
            "start",
            "--bind",
            f"127.0.0.1:{port}",
            "--user",
            "root",
            "--pass",
            "root",
            f"{storage}://{tmp_path}/data",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    db = observer = None
    ingester = None
    observers: list[asyncio.Task] = []
    producer = None
    try:
        async with httpx.AsyncClient() as http:
            for _ in range(200):
                try:
                    if (await http.get(f"http://127.0.0.1:{port}/health")).is_success:
                        break
                except httpx.ConnectError:
                    pass
                await asyncio.sleep(0.025)
            else:
                pytest.fail("SurrealDB did not start")
        url = f"ws://127.0.0.1:{port}/rpc"
        db = AsyncSurreal(url)
        await db.signin({"username": "root", "password": "root"})
        await db.use("test", "workload")
        core = (
            (PROJECT / "runtime/surreal-schema.ts")
            .read_text()
            .split("export const CORE_SCHEMA = `", 1)[1]
            .split("`", 1)[0]
        )
        await _query_last(db, core, {})
        if enabled:
            await _query_last(db, (PROJECT / "runtime/search-index-schema.surql").read_text(), {})
            await _query_last(db, "CREATE search_config:current SET enabled = true, ready = true", {})
        mocker.patch("events.ingester.get_db", return_value=db)
        mocker.patch("tasks.result_fetcher.get_db", return_value=db)

        app = Celery("search-test", broker="memory://", backend="cache+memory://")
        app.conf.result_backend_thread_safe = True
        total = rate * 2
        tasks = total // 4
        for index in range(tasks):
            app.backend.store_result(f"task-{index}", "backend-result-" + "x" * payload_size, "SUCCESS")
        read = app.backend.get_task_meta
        backend_reads = 0

        def read_result(task_id: str) -> dict:
            nonlocal backend_reads
            time.sleep(0.002)
            backend_reads += 1
            return read(task_id)

        mocker.patch.object(app.backend, "get_task_meta", side_effect=read_result)
        receiver = CeleryEventReceiver(app, asyncio.get_running_loop())
        ingester = SurrealDBIngester(
            receiver.queue, on_terminal=ResultFetcher(app).fetch_and_store, search_indexing_enabled=enabled
        )
        emitted: dict[tuple[str, str], float] = {}
        observed_states: set[tuple[str, str]] = set()
        live_latency: list[float] = []
        live_bytes: list[int] = []
        query_latency: list[float] = []
        observer = AsyncSurreal(url)
        await observer.signin({"username": "root", "password": "root"})
        await observer.use("test", "workload")
        live_id = await observer.live("task")
        stream = await observer.subscribe_live(live_id)

        async def observe() -> None:
            async for row in stream:
                assert "grams" not in row and "kwargs_terms" not in row
                key = (_extract_id(row["id"]), str(row["state"]))
                if key in emitted and key not in observed_states:
                    observed_states.add(key)
                    live_latency.append((time.perf_counter() - emitted[key]) * 1000)
                live_bytes.append(len(json.dumps(row, default=str)))

        async def search() -> None:
            while True:
                query = build_indexed_task_search("organization_id=9973")
                start = time.perf_counter()
                rows = await _query_last(
                    observer,
                    "".join(query.prelude) + f"SELECT * FROM {query.source} WHERE ({query.clause})",
                    query.bindings,
                )
                assert isinstance(rows, list)
                assert all("9973" in row["kwargs"] for row in rows)
                query_latency.append((time.perf_counter() - start) * 1000)
                await asyncio.sleep(0.05)

        observers = [asyncio.create_task(observe()), asyncio.create_task(search())]
        # Terminal events drive the actual consume loop and flush callback. Exclude the existing
        # periodic-flush overlap race from this index comparison; it is a separate ingestion concern.
        ingester._consume_task = asyncio.create_task(ingester._consume_loop())
        start = time.perf_counter()

        def produce() -> None:
            states = [
                ("task-sent", "PENDING"),
                ("task-received", "RECEIVED"),
                ("task-started", "STARTED"),
                ("task-succeeded", "SUCCESS"),
            ]
            for number in range(total):
                delay = start + number / rate - time.perf_counter()
                if delay > 0:
                    time.sleep(delay)
                index, phase = divmod(number, 4)
                task_id = f"task-{index}"
                kind, state = states[phase]
                emitted[(task_id, state)] = time.perf_counter()
                event = {"type": kind, "uuid": task_id, "timestamp": time.time(), "hostname": "celery@test"}
                if phase == 0:
                    event.update(
                        name="reports.render",
                        args="()" if not payload_size else repr(["x" * 16_384]),
                        kwargs=repr({"organization_id": 9973 if index % 11 == 0 else index}),
                    )
                receiver.on_event(event)

        producer = Thread(target=produce, daemon=True)
        producer.start()
        pending_at_stop = None
        async with asyncio.timeout(40):
            while ingester._stats_events_total < total or producer.is_alive():
                if not producer.is_alive() and pending_at_stop is None:
                    pending_at_stop = total - ingester._stats_events_total
                await asyncio.sleep(0.025)
            while True:
                rows = await _query_last(db, "SELECT count() AS count FROM task WHERE result != NONE GROUP ALL", {})
                if isinstance(rows, list) and rows and rows[0]["count"] == tasks:
                    break
                await asyncio.sleep(0.025)
        elapsed = time.perf_counter() - start
        await asyncio.sleep(0.1)
        for task in observers:
            if task.done():
                task.result()
        assert ingester._dropped_count == 0
        assert backend_reads >= tasks
        assert live_latency and query_latency
        counts = await _query_last(db, "SELECT count() AS count FROM event GROUP ALL", {})
        assert isinstance(counts, list)
        assert counts[0]["count"] == total
        measurement = {
            "enabled": enabled,
            "storage": storage,
            "events_per_second": rate,
            "result_bytes": payload_size,
            "events": total,
            "backend_reads": backend_reads,
            "elapsed_seconds": round(elapsed, 3),
            "pending_at_input_stop": pending_at_stop or 0,
            "live_p95_ms": percentile(live_latency),
            "search_p95_ms": percentile(query_latency),
            "live_notifications": len(live_bytes),
            "live_mean_bytes": round(sum(live_bytes) / len(live_bytes)),
        }
        logger.info("Search workload: %s", json.dumps(measurement))
        if output := os.environ.get("SEARCH_BENCHMARK_OUTPUT"):
            with Path(output).open("a") as evidence:
                evidence.write(json.dumps(measurement) + "\n")
        app.close()
    finally:
        if producer:
            await asyncio.to_thread(producer.join, 10)
        if ingester:
            await ingester.stop()
        for task in observers:
            task.cancel()
        await asyncio.gather(*observers, return_exceptions=True)
        if observer:
            await observer.close()
        if db:
            await db.close()
        process.terminate()
        await asyncio.to_thread(process.wait, timeout=10)
