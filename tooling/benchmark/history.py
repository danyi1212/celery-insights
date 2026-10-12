"""Bounded direct seeding for retained-history reads/storage, outside ingestion timing."""

import argparse
import asyncio
import json
import logging
import os
import sys
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path

from surrealdb import AsyncSurreal

from pipeline import query


def fixture_batch(start: int, end: int, total: int, reference: datetime, payload_bytes: int) -> dict:
    tasks, events, workflows, edges = [], [], [], []
    for index in range(start, end):
        task_id = f"history-{index}"
        root = index // 4 * 4
        timestamp = reference - timedelta(seconds=600 + index % 1800)
        failed = index % 10 == 0
        task = {
            "id": task_id,
            "type": f"history.work.{index % 4}",
            "state": "FAILURE" if failed else "SUCCESS",
            "workflow_id": f"history-{root}",
            "root_id": f"history-{root}",
            "worker": f"history-worker-{index % 8}",
            "last_updated": timestamp,
            "first_observed_at": timestamp - timedelta(seconds=3),
            "sent_at": timestamp - timedelta(seconds=3),
            "received_at": timestamp - timedelta(seconds=2),
            "started_at": timestamp - timedelta(seconds=1),
            "runtime": 1.0,
            "kwargs": repr({"organization_id": index % 11}),
            "kwargs_search_source": "repr",
            "args": "()",
            "had_error": failed,
        }
        if root != index:
            task["parent_id"] = f"history-{root}"
        else:
            task["children"] = [f"history-{child}" for child in range(index + 1, min(index + 4, total))]
        if failed:
            task.update(failed_at=timestamp, exception="HistoricalError('fixture')")
        else:
            task.update(succeeded_at=timestamp, result=repr(f"history-result-{index}" + "x" * payload_bytes))
        tasks.append(task)
        for phase, kind in enumerate(
            ["task-sent", "task-received", "task-started", "task-failed" if failed else "task-succeeded"]
        ):
            events.append(
                {
                    "id": f"history-{index}-{phase}",
                    "task_id": task_id,
                    "event_type": kind,
                    "timestamp": timestamp - timedelta(seconds=3 - phase),
                    "hostname": task["worker"],
                    "data": json.dumps({"uuid": task_id, "type": kind}),
                }
            )
        edges.append(
            {"id": f"history-{root}:{task_id}", "root": f"history-{root}", "task": task_id, "timestamp": timestamp}
        )
        if root == index:
            count = min(4, total - index)
            failures = sum(child % 10 == 0 for child in range(index, index + count))
            workflows.append(
                {
                    "id": task_id,
                    "root_task_id": task_id,
                    "root_task_type": "history.work.0",
                    "task_count": count,
                    "completed_count": count,
                    "failure_count": failures,
                    "aggregate_state": "FAILURE" if failures else "SUCCESS",
                    "active_count": 0,
                    "worker_count": count,
                    "first_seen_at": timestamp - timedelta(seconds=3),
                    "last_updated": timestamp,
                }
            )
    return {"tasks": tasks, "events": events, "workflows": workflows, "edges": edges}


async def seed(arguments: argparse.Namespace) -> dict:
    reference = datetime.fromisoformat(arguments.reference_time).astimezone(UTC)
    db = AsyncSurreal(os.environ["BENCH_DB_URL"])
    retries = 0
    payload = 0
    batches = []
    started = time.perf_counter()
    try:
        await db.signin(
            {
                "namespace": "celery_insights",
                "database": "main",
                "username": "ingester",
                "password": os.environ["BENCH_WRITER_PASSWORD"],
            }
        )
        await db.use("celery_insights", "main")
        existing = await query(db, "SELECT count() AS count FROM task GROUP ALL")
        if existing and existing[0]["count"]:
            raise RuntimeError("History fixture requires the fresh private benchmark database")
        configuration = await query(db, "SELECT enabled, ready FROM search_config:current")
        indexed = bool(configuration and configuration[0].get("enabled"))
        if indexed and not configuration[0].get("ready"):
            raise RuntimeError("Search projections are not ready for indexed fixture setup")
        if indexed:
            # Use the helper shipped in the measured production image, not a
            # duplicate benchmark normalizer. Database events build text grams.
            production_server = Path("/app/server")
            if not production_server.is_dir():
                production_server = Path(__file__).resolve().parents[2] / "server"
            sys.path.insert(0, str(production_server))
            from tasks.task_search import kwargs_search_terms

        enrich = (
            "UPDATE type::record('task_search', $row.id) SET kwargs_terms = $row.terms, "
            "kwargs_fallback = $row.fallback;"
            if indexed
            else ""
        )
        sql = (
            "BEGIN; FOR $row IN $tasks { CREATE type::record('task', $row.id) "
            f"CONTENT $row.content RETURN NONE; {enrich} }};"
            "FOR $row IN $events { CREATE type::record('event', $row.id) "
            "CONTENT $row.content RETURN NONE; };"
            "FOR $row IN $workflows { CREATE type::record('workflow', $row.id) "
            "CONTENT $row.content RETURN NONE; };"
            "FOR $row IN $edges { RELATE (type::record('workflow', $row.root))"
            "->(type::record('workflow_task', $row.id))"
            "->(type::record('task', $row.task)) SET last_updated = $row.timestamp, "
            "created_at = $row.timestamp RETURN NONE; }; COMMIT"
        )
        writes_started = time.perf_counter()
        for start in range(0, arguments.tasks, 500):
            batch_started = time.perf_counter()
            batch = fixture_batch(
                start, min(start + 500, arguments.tasks), arguments.tasks, reference, arguments.payload_bytes
            )
            payload += sum(
                len(value.encode())
                for rows in batch.values()
                for row in rows
                for value in row.values()
                if isinstance(value, str)
            )
            bindings = {
                table: [
                    {"id": row["id"], "content": {key: value for key, value in row.items() if key != "id"}}
                    for row in batch[table]
                ]
                for table in ("tasks", "events", "workflows")
            }
            bindings["edges"] = batch["edges"]
            if indexed:
                for row in bindings["tasks"]:
                    terms = kwargs_search_terms(row["content"]["kwargs"], "repr")
                    row.update(terms=terms.terms, fallback=terms.fallback)
            for attempt in range(4):
                try:
                    await query(db, sql, bindings)
                    break
                except RuntimeError as error:
                    if "conflict" not in str(error).lower() or attempt == 3:
                        raise
                    retries += 1
                    await asyncio.sleep(0.1)
            completed = min(start + 500, arguments.tasks)
            batches.append({"tasks": completed - start, "seconds": time.perf_counter() - batch_started})
            if completed % 10_000 == 0 or completed == arguments.tasks:
                sys.stderr.write(
                    json.dumps({"seeded_tasks": completed, "elapsed_seconds": time.perf_counter() - started}) + "\n"
                )
                sys.stderr.flush()
        write_seconds = time.perf_counter() - writes_started
        for index in range(min(8, arguments.tasks)):
            await query(
                db,
                "CREATE type::record('worker', $id) SET status = 'online', last_updated = $ts",
                {"id": f"history-worker-{index}", "ts": reference},
            )
        counts = {}
        validation_started = time.perf_counter()
        for table in ["task", "event", "workflow", "workflow_task"]:
            rows = await query(db, f"SELECT count() AS count FROM {table} GROUP ALL")
            counts[table] = rows[0]["count"] if rows else 0
        expected = {
            "task": arguments.tasks,
            "event": arguments.tasks * 4,
            "workflow": (arguments.tasks + 3) // 4,
            "workflow_task": arguments.tasks,
        }
        if counts != expected:
            raise RuntimeError(f"Seed record counts differ: {counts} versus {expected}")
        projections = {}
        if indexed:
            for table, expected_count in [
                ("task_search", arguments.tasks),
                ("workflow_search", (arguments.tasks + 3) // 4),
            ]:
                rows = await query(db, f"SELECT count() AS count FROM {table} GROUP ALL")
                projections[table] = rows[0]["count"] if rows else 0
                if projections[table] != expected_count:
                    raise RuntimeError(f"Incomplete {table} projection: {projections[table]} versus {expected_count}")
        return {
            "status": "passed",
            "fixture_version": 2,
            "indexed": indexed,
            "projection_counts": projections,
            "tasks": arguments.tasks,
            "reference_time": reference.isoformat(),
            "payload_bytes_per_success_result": arguments.payload_bytes,
            "record_counts": counts,
            "generated_string_field_bytes": payload,
            "seed_seconds": time.perf_counter() - started,
            "write_seconds": write_seconds,
            "count_validation_seconds": time.perf_counter() - validation_started,
            "batches": batches,
            "transaction_retries": retries,
            "limitations": [
                "Direct fixture setup, not ingestion throughput or Celery backend key cardinality.",
                "String-field bytes exclude engine/schema/index/WAL and datetime/numeric overhead.",
            ],
        }
    finally:
        await db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tasks", type=int, required=True)
    parser.add_argument("--reference-time", required=True)
    parser.add_argument("--payload-bytes", type=int, default=256)
    args = parser.parse_args()
    if args.tasks <= 0 or not 0 <= args.payload_bytes <= 100_000:
        parser.error("tasks must be positive; payload must be between 0 and 100,000 bytes")
    try:
        report = asyncio.run(seed(args))
    except Exception as error:
        logging.exception("History fixture failed")
        report = {"status": "failed", "error": f"{type(error).__name__}: {error}"}
    sys.stdout.write(json.dumps(report, default=str) + "\n")
    raise SystemExit(0 if report["status"] == "passed" else 1)
