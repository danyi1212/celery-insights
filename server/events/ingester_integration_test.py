"""Exercise the ingestion queries on the same native engine used in production."""

import asyncio
import shutil
import socket
import subprocess
from datetime import UTC, datetime, timedelta
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
from tasks.result_fetcher import _build_task_meta_upsert


@pytest.mark.skipif(shutil.which("surreal") is None, reason="SurrealDB 3.3+ CLI required")
@pytest.mark.asyncio
async def test_batched_recovery_preserves_workflow_invocation_and_errors():
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
            events = [
                {"type": "task-sent", "uuid": "root", "timestamp": 1700000000.0, "name": "reports.generate"},
                {
                    "type": "task-sent",
                    "uuid": "child",
                    "root_id": "root",
                    "timestamp": 1700000001.0,
                    "name": "reports.render",
                },
                {"type": "task-retried", "uuid": "child", "timestamp": 1700000002.0, "exception": "TimeoutError()"},
                {"type": "task-succeeded", "uuid": "child", "timestamp": 1700000003.0},
                {"type": "task-received", "uuid": "child", "timestamp": 1700000001.5},
            ]
            queries = []
            params = {}
            for index, event in enumerate(events):
                for build in [build_task_upsert, build_workflow_membership_upsert, build_workflow_summary_recompute]:
                    query, bindings = build(event, index)
                    queries.append(query)
                    params.update(bindings)
            await db.query("BEGIN TRANSACTION;" + ";".join(queries) + ";COMMIT TRANSACTION;", params)
            child = (await rows("SELECT * FROM task:child"))[0]
            assert child["state"] == "SUCCESS"
            assert child["workflow_id"] == "root"
            assert child["type"] == "reports.render"
            assert child["had_error"] is True
            assert child["first_observed_at"] == datetime.fromtimestamp(1700000001, tz=UTC)
            assert len(await rows("SELECT * FROM workflow_task")) == 2
            assert (await rows("SELECT * FROM workflow:root"))[0]["task_count"] == 2

            query, bindings = _build_task_meta_upsert(
                "child", {"status": "SUCCESS", "date_done": "2023-11-14T22:13:24Z"}
            )
            await db.query(query, bindings)
            refreshed = (await rows("SELECT * FROM task:child"))[0]
            assert refreshed["workflow_id"] == "root"
            assert refreshed["had_error"] is True
            assert refreshed["first_observed_at"] == child["first_observed_at"]
            assert refreshed["sent_at"] == child["sent_at"]
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
