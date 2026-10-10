"""Exercise the ingestion queries on the same native engine used in production."""

import asyncio
import shutil
import socket
import subprocess
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import httpx
import pytest
from surrealdb import AsyncSurreal
from surrealdb.connections.async_ws import AsyncWsSurrealConnection

from events.ingester import (
    build_task_upsert,
    build_worker_upsert,
    build_workflow_membership_upsert,
    build_workflow_summary_recompute,
)
from tasks.task_search import keyword_search_term
from tasks.result_fetcher import _build_task_meta_upsert


@pytest.mark.skipif(shutil.which("surreal") is None, reason="SurrealDB 3.3+ CLI required")
@pytest.mark.asyncio
@pytest.mark.parametrize("poll_before_events", [False, True])
@pytest.mark.parametrize("search_indexing_enabled", [False, True])
async def test_batched_recovery_preserves_workflow_invocation_and_errors(
    *, poll_before_events: bool, search_indexing_enabled: bool
) -> None:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    process = subprocess.Popen(
        ["surreal", "start", "--bind", f"127.0.0.1:{port}", "--user", "root", "--pass", "root", "memory"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        async with httpx.AsyncClient() as http:
            for _ in range(100):
                try:
                    if (await http.get(f"http://127.0.0.1:{port}/health")).is_success:
                        break
                except httpx.ConnectError:
                    pass
                await asyncio.sleep(0.1)
            else:
                pytest.fail("SurrealDB did not start")
        async with AsyncSurreal(f"ws://127.0.0.1:{port}/rpc") as db:

            async def rows(sql: str) -> list[dict]:
                result = await db.query(sql)
                assert isinstance(result, list)
                records = []
                for value in result:
                    assert isinstance(value, dict)
                    records.append(value)
                return records

            await db.signin({"username": "root", "password": "root"})
            await db.use("integration", "ingestion")
            await db.query(
                "DEFINE TABLE task SCHEMALESS; DEFINE TABLE workflow SCHEMALESS; "
                "DEFINE TABLE workflow_task TYPE RELATION IN workflow OUT task"
            )
            if search_indexing_enabled:
                schema = Path(__file__).resolve().parents[2] / "runtime/search-index-schema.surql"
                await db.query(schema.read_text())
                await db.query("CREATE search_config:current SET enabled = true, ready = true")
            if poll_before_events:
                query, bindings = _build_task_meta_upsert(
                    "child",
                    {"status": "STARTED", "date_done": "2023-11-14T22:13:22.500Z"},
                    search_indexing_enabled=search_indexing_enabled,
                )
                summary_query, summary_bindings = build_workflow_summary_recompute(
                    {"uuid": "child", "timestamp": 1700000002.5}, 0
                )
                await db.query(f"{query};{summary_query}", bindings | summary_bindings)
                assert (await rows("SELECT * FROM workflow:child"))[0]["task_count"] == 1
            events = [
                {"type": "task-sent", "uuid": "root", "timestamp": 1700000000.0, "name": "reports.generate"},
                {
                    "type": "task-sent",
                    "uuid": "child",
                    "root_id": "root",
                    "parent_id": "root",
                    "timestamp": 1700000001.0,
                    "name": "reports.render",
                    "routing_key": "reports",
                    "args": "('2023-11',)",
                    "kwargs": "{'fmt': 'pdf'}",
                    "retries": 1,
                },
                {"type": "task-retried", "uuid": "child", "timestamp": 1700000002.0, "exception": "TimeoutError()"},
                {"type": "task-succeeded", "uuid": "child", "timestamp": 1700000003.0},
                {"type": "task-received", "uuid": "child", "timestamp": 1700000001.5, "hostname": "worker-1"},
            ]
            queries = []
            params = {}
            for index, event in enumerate(events):
                for build in [build_task_upsert, build_workflow_membership_upsert, build_workflow_summary_recompute]:
                    query, bindings = (
                        build(event, index, search_indexing_enabled=search_indexing_enabled)
                        if build is build_task_upsert
                        else build(event, index)
                    )
                    queries.append(query)
                    params.update(bindings)
            await db.query("BEGIN TRANSACTION;" + ";".join(queries) + ";COMMIT TRANSACTION;", params)
            child = (await rows("SELECT * FROM task:child"))[0]
            assert child["state"] == "SUCCESS"
            assert child["workflow_id"] == "root"
            assert child["root_id"] == "root"
            assert child["parent_id"] == "root"
            assert child["routing_key"] == "reports"
            invocation = {
                "type": "reports.render",
                "args": "('2023-11',)",
                "kwargs": "{'fmt': 'pdf'}",
                "retries": 1,
                "routing_key": "reports",
                "worker": "worker-1",
            }
            assert {field: child.get(field) for field in invocation} == invocation
            assert child["had_error"] is True
            assert child["first_observed_at"] == datetime.fromtimestamp(1700000001, tz=UTC)
            assert len(await rows("SELECT * FROM workflow_task")) == 2
            assert (await rows("SELECT * FROM workflow:root"))[0]["task_count"] == 2
            assert await rows("SELECT * FROM workflow:child") == []
            assert child["kwargs_search_source"] == "saferepr"
            if search_indexing_enabled:
                projection = (await rows("SELECT * FROM task_search:child"))[0]
                assert keyword_search_term("fmt=pdf") in projection["kwargs_terms"]
                assert projection["kwargs_fallback"] is False
                assert await rows("SELECT * FROM workflow_search:child") == []

            query, bindings = _build_task_meta_upsert(
                "child",
                {"status": "SUCCESS", "date_done": "2023-11-14T22:13:24Z"},
                search_indexing_enabled=search_indexing_enabled,
            )
            await db.query(query, bindings)
            refreshed = (await rows("SELECT * FROM task:child"))[0]
            assert refreshed["workflow_id"] == "root"
            assert refreshed["had_error"] is True
            assert refreshed["first_observed_at"] == child["first_observed_at"]
            assert refreshed["sent_at"] == child["sent_at"]
            assert {field: refreshed.get(field) for field in invocation} == invocation
            assert refreshed["kwargs_search_source"] == "saferepr"
            if search_indexing_enabled:
                assert (await rows("SELECT * FROM task_search:child"))[0]["kwargs_terms"] == projection["kwargs_terms"]

            stale = {
                "type": "task-sent",
                "uuid": "child",
                "root_id": "stale-root",
                "parent_id": "stale-parent",
                "timestamp": 1700000000.5,
            }
            query, bindings = build_task_upsert(stale, 0, search_indexing_enabled=search_indexing_enabled)
            await db.query(query, bindings)
            after_stale = (await rows("SELECT * FROM task:child"))[0]
            assert after_stale["root_id"] == "root"
            assert after_stale["workflow_id"] == "root"
            assert after_stale["parent_id"] == "root"
            assert after_stale["state"] == "SUCCESS"
            assert after_stale["last_updated"] == refreshed["last_updated"]
            assert len(await rows("SELECT * FROM workflow:root")) == 1
    finally:
        process.terminate()
        await asyncio.to_thread(process.wait, timeout=10)


@pytest.mark.asyncio
async def test_worker_offline_event_clears_earlier_execution_observations(
    surreal_db: AsyncWsSurrealConnection,
) -> None:
    await surreal_db.query(
        "CREATE worker:`worker@host` SET status = 'online', last_updated = <datetime>'2026-10-06T12:00:00Z'; "
        "CREATE task:observed, task:later, task:other SET state = 'STARTED', worker = 'worker@host', "
        "workflow_id = 'root', execution_active = true, "
        "execution_observed_at = <datetime>'2026-10-06T12:00:00Z', last_updated = <datetime>'2026-10-06T11:59:00Z'; "
        "UPDATE task:later SET execution_observed_at = <datetime>'2026-10-06T12:02:00Z'; "
        "UPDATE task:other SET worker = 'other@host'"
    )
    offline_at = datetime(2026, 10, 6, 12, 1, tzinfo=UTC).timestamp()
    query, parameters = build_worker_upsert(
        {"type": "worker-offline", "hostname": "worker@host", "timestamp": offline_at}, 0
    )
    await surreal_db.query(query, parameters)
    worker = cast(list[dict[str, Any]], await surreal_db.query("SELECT * FROM worker:`worker@host`"))[0]
    tasks = {str(task["id"]): task for task in cast(list[dict[str, Any]], await surreal_db.query("SELECT * FROM task"))}
    assert worker["status"] == "offline"
    assert tasks["task:observed"].get("execution_active") is None
    assert tasks["task:observed"]["execution_observed_at"] == datetime(2026, 10, 6, 12, tzinfo=UTC)
    assert tasks["task:observed"]["state"] == "STARTED"
    assert tasks["task:later"]["execution_active"] is True
    assert tasks["task:other"]["execution_active"] is True


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("terminal_event", "expected_fields"),
    [
        (
            {"type": "task-succeeded", "result": "42", "runtime": 1.5},
            {"state": "SUCCESS", "result": "42", "runtime": 1.5},
        ),
        (
            {"type": "task-failed", "exception": "ValueError('boom')", "traceback": "Traceback ..."},
            {"state": "FAILURE", "exception": "ValueError('boom')", "traceback": "Traceback ..."},
        ),
    ],
)
async def test_older_terminal_event_replaces_an_undated_observation(
    surreal_db: AsyncWsSurrealConnection, terminal_event: dict[str, Any], expected_fields: dict[str, Any]
) -> None:
    query, parameters = _build_task_meta_upsert(
        "undated", {"status": "STARTED", "result": {"pid": 7, "hostname": "stale@host"}}
    )
    await surreal_db.query(query, parameters)
    observed_at = cast(list[dict[str, Any]], await surreal_db.query("SELECT * FROM task:undated"))[0]["last_updated"]
    event_at = observed_at - timedelta(seconds=2)

    query, parameters = build_task_upsert(
        {"type": "task-received", "uuid": "undated", "timestamp": event_at.timestamp()}, 0
    )
    await surreal_db.query(query, parameters)
    task = cast(list[dict[str, Any]], await surreal_db.query("SELECT * FROM task:undated"))[0]
    assert task["state"] == "STARTED"
    assert task["last_updated"] == observed_at
    assert task["last_updated_observed"] is True

    query, parameters = build_task_upsert(
        {**terminal_event, "uuid": "undated", "timestamp": event_at.timestamp(), "hostname": "worker@host"}, 0
    )
    await surreal_db.query(query, parameters)
    task = cast(list[dict[str, Any]], await surreal_db.query("SELECT * FROM task:undated"))[0]
    assert {field: task.get(field) for field in expected_fields} == expected_fields
    assert task["worker"] == "worker@host"
    assert task["last_updated"] == event_at
    assert task["last_updated_observed"] is False


@pytest.mark.asyncio
async def test_same_state_event_fills_missing_outcome_fields(surreal_db: AsyncWsSurrealConnection) -> None:
    query, parameters = _build_task_meta_upsert("done", {"status": "SUCCESS", "date_done": "2026-10-06T12:00:00Z"})
    await surreal_db.query(query, parameters)
    query, parameters = build_task_upsert(
        {
            "type": "task-succeeded",
            "uuid": "done",
            "timestamp": datetime(2026, 10, 6, 11, 59, 59, tzinfo=UTC).timestamp(),
            "result": "42",
            "runtime": 1.5,
        },
        0,
    )
    await surreal_db.query(query, parameters)
    task = cast(list[dict[str, Any]], await surreal_db.query("SELECT * FROM task:done"))[0]
    assert task["state"] == "SUCCESS"
    assert task["result"] == "42"
    assert task["runtime"] == 1.5
    assert task["last_updated"] == datetime(2026, 10, 6, 12, tzinfo=UTC)


@pytest.mark.asyncio
async def test_same_terminal_event_replaces_an_undated_terminal_observation(
    surreal_db: AsyncWsSurrealConnection,
) -> None:
    query, parameters = _build_task_meta_upsert("undated", {"status": "SUCCESS", "result": 42})
    await surreal_db.query(query, parameters)
    observed_at = cast(list[dict[str, Any]], await surreal_db.query("SELECT * FROM task:undated"))[0]["last_updated"]
    event_at = observed_at - timedelta(seconds=2)

    query, parameters = build_task_upsert(
        {"type": "task-succeeded", "uuid": "undated", "timestamp": event_at.timestamp(), "runtime": 1.5}, 0
    )
    await surreal_db.query(query, parameters)
    task = cast(list[dict[str, Any]], await surreal_db.query("SELECT * FROM task:undated"))[0]
    assert task["state"] == "SUCCESS"
    assert task["succeeded_at"] == event_at
    assert task["runtime"] == 1.5
    assert task["last_updated"] == event_at
    assert task["last_updated_observed"] is False
