"""Exercise the ingestion queries on the same native engine used in production."""

import asyncio
import shutil
import socket
import subprocess
from datetime import UTC, datetime

import httpx
import pytest
from surrealdb import AsyncSurreal

from events.ingester import build_task_upsert, build_workflow_membership_upsert, build_workflow_summary_recompute
from tasks.result_fetcher import _build_task_meta_upsert


@pytest.mark.skipif(shutil.which("surreal") is None, reason="SurrealDB 3.3+ CLI required")
@pytest.mark.asyncio
@pytest.mark.parametrize("poll_before_events", [False, True])
async def test_batched_recovery_preserves_workflow_invocation_and_errors(*, poll_before_events: bool) -> None:
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
            if poll_before_events:
                query, bindings = _build_task_meta_upsert(
                    "child", {"status": "STARTED", "date_done": "2023-11-14T22:13:22.500Z"}
                )
                await db.query(query, bindings)
            events = [
                {"type": "task-sent", "uuid": "root", "timestamp": 1700000000.0, "name": "reports.generate"},
                {
                    "type": "task-sent",
                    "uuid": "child",
                    "root_id": "root",
                    "parent_id": "root",
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
            assert child["root_id"] == "root"
            assert child["parent_id"] == "root"
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
