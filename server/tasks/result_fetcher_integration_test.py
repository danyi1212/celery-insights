from datetime import UTC, datetime, timedelta
from typing import Any, cast

import pytest
from surrealdb.connections.async_ws import AsyncWsSurrealConnection

from events.ingester import build_task_upsert
from tasks.result_fetcher import _build_task_meta_upsert


@pytest.mark.asyncio
@pytest.mark.parametrize("state", ["STARTED", "SUCCESS"])
async def test_reimporting_undated_started_metadata_preserves_history(
    surreal_db: AsyncWsSurrealConnection, state: str
) -> None:
    await surreal_db.query(
        "CREATE task:old SET state = $state, workflow_id = 'root', worker = 'worker@host', "
        "type = 'tasks.old', kwargs = '{\"key\": 1}', result = '42', "
        "last_updated = <datetime>'2026-10-06T12:00:00Z', sent_at = <datetime>'2026-10-06T11:59:00Z'",
        {"state": state},
    )
    for _ in range(2):
        query, parameters = _build_task_meta_upsert("old", {"status": "STARTED", "result": {"pid": 10}})
        await surreal_db.query(query, parameters)
    task = cast(list[dict[str, Any]], await surreal_db.query("SELECT * FROM task:old"))[0]
    assert task["state"] == state
    assert task["last_updated"] == datetime(2026, 10, 6, 12, tzinfo=UTC)
    assert task["sent_at"] == datetime(2026, 10, 6, 11, 59, tzinfo=UTC)
    assert task["worker"] == "worker@host"
    assert task["kwargs"] == '{"key": 1}'
    assert task["type"] == "tasks.old"
    if state == "SUCCESS":
        assert task["result"] == "42"


@pytest.mark.asyncio
async def test_older_dated_metadata_does_not_regress_a_terminal_event(surreal_db: AsyncWsSurrealConnection) -> None:
    await surreal_db.query(
        "CREATE task:finished SET state = 'SUCCESS', workflow_id = 'root', result = '42', "
        "last_updated = <datetime>'2026-10-06T12:00:00Z'"
    )
    query, parameters = _build_task_meta_upsert(
        "finished", {"status": "FAILURE", "date_done": "2026-10-06T11:59:00Z", "result": "old failure"}
    )
    await surreal_db.query(query, parameters)
    task = cast(list[dict[str, Any]], await surreal_db.query("SELECT * FROM task:finished"))[0]
    assert task["state"] == "SUCCESS"
    assert task["result"] == "42"
    assert task.get("failed_at") is None
    assert task["had_error"] is True


@pytest.mark.asyncio
async def test_undated_completion_does_not_invent_a_finish_time(surreal_db: AsyncWsSurrealConnection) -> None:
    await surreal_db.query(
        "CREATE task:finished SET state = 'STARTED', workflow_id = 'root', "
        "last_updated = <datetime>'2026-10-06T12:00:00Z'"
    )
    query, parameters = _build_task_meta_upsert("finished", {"status": "SUCCESS", "result": 42})
    await surreal_db.query(query, parameters)
    task = cast(list[dict[str, Any]], await surreal_db.query("SELECT * FROM task:finished"))[0]
    assert task["state"] == "SUCCESS"
    assert task["result"] == "42"
    assert task.get("succeeded_at") is None
    assert task["last_updated"] == datetime(2026, 10, 6, 12, tzinfo=UTC)


@pytest.mark.asyncio
async def test_older_extended_metadata_fills_invocation_gaps_after_a_terminal_event(
    surreal_db: AsyncWsSurrealConnection,
) -> None:
    await surreal_db.query(
        "CREATE task:finished SET state = 'SUCCESS', workflow_id = 'root', result = '42', worker = 'event@host', "
        "last_updated = <datetime>'2026-10-06T12:00:00Z', succeeded_at = <datetime>'2026-10-06T12:00:00Z'"
    )
    query, parameters = _build_task_meta_upsert(
        "finished",
        {
            "status": "SUCCESS",
            "date_done": "2026-10-06T11:59:59Z",
            "result": 41,
            "name": "tasks.finished",
            "args": [1],
            "kwargs": {"key": 2},
            "worker": "backend@host",
            "retries": 3,
            "queue": "reports",
        },
    )
    await surreal_db.query(query, parameters)
    task = cast(list[dict[str, Any]], await surreal_db.query("SELECT * FROM task:finished"))[0]
    assert task["state"] == "SUCCESS"
    assert task["result"] == "42"
    assert task["last_updated"] == datetime(2026, 10, 6, 12, tzinfo=UTC)
    assert task["succeeded_at"] == datetime(2026, 10, 6, 12, tzinfo=UTC)
    assert task["worker"] == "event@host"
    assert task["type"] == "tasks.finished"
    assert task["args"] == "[1]"
    assert task["kwargs"] == "{'key': 2}"
    assert task["retries"] == 3
    assert task["routing_key"] == "reports"


@pytest.mark.asyncio
async def test_dated_completion_replaces_an_undated_observation(surreal_db: AsyncWsSurrealConnection) -> None:
    query, parameters = _build_task_meta_upsert("racing", {"status": "STARTED", "result": {"pid": 10}})
    await surreal_db.query(query, parameters)
    observed = cast(list[dict[str, Any]], await surreal_db.query("SELECT * FROM task:racing"))[0]
    assert observed["state"] == "STARTED"

    # The task finished between the metadata read and the upsert, so date_done precedes the observation.
    date_done = observed["last_updated"] - timedelta(seconds=1)
    query, parameters = _build_task_meta_upsert(
        "racing", {"status": "SUCCESS", "date_done": date_done.isoformat(), "result": 42}
    )
    await surreal_db.query(query, parameters)
    task = cast(list[dict[str, Any]], await surreal_db.query("SELECT * FROM task:racing"))[0]
    assert task["state"] == "SUCCESS"
    assert task["result"] == "42"
    assert task["succeeded_at"] == date_done
    assert task["last_updated"] == date_done
    assert observed["last_updated_observed"] is True
    assert task["last_updated_observed"] is False


@pytest.mark.asyncio
async def test_older_dated_metadata_does_not_regress_newer_event_evidence(
    surreal_db: AsyncWsSurrealConnection,
) -> None:
    query, parameters = _build_task_meta_upsert("restarted", {"status": "STARTED"})
    await surreal_db.query(query, parameters)
    started_at = datetime.now(tz=UTC) + timedelta(minutes=1)
    query, parameters = build_task_upsert(
        {"type": "task-started", "uuid": "restarted", "timestamp": started_at.timestamp(), "hostname": "worker@host"},
        0,
    )
    await surreal_db.query(query, parameters)
    query, parameters = _build_task_meta_upsert(
        "restarted", {"status": "SUCCESS", "date_done": datetime.now(tz=UTC).isoformat(), "result": 42}
    )
    await surreal_db.query(query, parameters)
    task = cast(list[dict[str, Any]], await surreal_db.query("SELECT * FROM task:restarted"))[0]
    assert task["state"] == "STARTED"
    assert task["last_updated_observed"] is False
    assert task.get("succeeded_at") is None
