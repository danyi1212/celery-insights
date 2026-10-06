from datetime import UTC, datetime
from typing import Any, cast

import pytest
from surrealdb.connections.async_ws import AsyncWsSurrealConnection

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
