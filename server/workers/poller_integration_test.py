from datetime import UTC, datetime
from typing import Any, cast

import pytest
from pytest_mock import MockerFixture
from surrealdb.connections.async_ws import AsyncWsSurrealConnection

from workers.poller import MISSED_POLLS_THRESHOLD, WorkerPoller


@pytest.mark.asyncio
async def test_worker_inspection_separates_execution_from_reported_state(
    surreal_db: AsyncWsSurrealConnection, mocker: MockerFixture
) -> None:
    mocker.patch("workers.poller.get_db", return_value=surreal_db)
    await surreal_db.query(
        "CREATE task:active, task:stale, task:recent, task:finished, task:other SET "
        "state = 'STARTED', worker = 'worker@host', workflow_id = 'root', "
        "last_updated = <datetime>'2026-10-06T12:00:00Z'; "
        "UPDATE task:finished SET state = 'SUCCESS'; "
        "UPDATE task:other SET worker = 'other@host'; "
        "UPDATE task:recent SET last_updated = <datetime>'2026-10-06T12:01:01Z'"
    )
    inspect = {
        "worker@host": {
            "active": [{"id": "active"}],
            "_observed_at": {"active": "2026-10-06T12:01:00Z"},
        }
    }
    mocker.patch("workers.poller.asyncio.to_thread", return_value=inspect)
    await WorkerPoller(mocker.MagicMock())._poll()
    tasks = {str(task["id"]): task for task in cast(list[dict[str, Any]], await surreal_db.query("SELECT * FROM task"))}
    assert tasks["task:active"]["execution_active"] is True
    assert tasks["task:stale"]["execution_active"] is False
    assert tasks["task:stale"]["state"] == "STARTED"
    assert tasks["task:stale"]["last_updated"] == datetime(2026, 10, 6, 12, tzinfo=UTC)
    for identifier in ["recent", "finished", "other"]:
        assert tasks[f"task:{identifier}"].get("execution_active") is None

    inspect["worker@host"] = {"stats": {"pid": 10}}
    await WorkerPoller(mocker.MagicMock())._poll()
    active = cast(list[dict[str, Any]], await surreal_db.query("SELECT * FROM task:active"))[0]
    assert active.get("execution_active") is None


@pytest.mark.asyncio
async def test_missing_worker_invalidates_execution_after_missed_polls(
    surreal_db: AsyncWsSurrealConnection, mocker: MockerFixture
) -> None:
    mocker.patch("workers.poller.get_db", return_value=surreal_db)
    mocker.patch("workers.poller.asyncio.to_thread", return_value={})
    await surreal_db.query(
        "CREATE worker:`worker@host` SET status = 'online', missed_polls = 0; "
        "CREATE task:stale SET state = 'STARTED', worker = 'worker@host', workflow_id = 'root', "
        "execution_active = true, execution_observed_at = time::now(), last_updated = time::now()"
    )
    poller = WorkerPoller(mocker.MagicMock())
    for _ in range(MISSED_POLLS_THRESHOLD):
        await poller._poll()
    worker = cast(list[dict[str, Any]], await surreal_db.query("SELECT * FROM worker"))[0]
    task = cast(list[dict[str, Any]], await surreal_db.query("SELECT * FROM task:stale"))[0]
    assert worker["status"] == "offline"
    assert worker["missed_polls"] == MISSED_POLLS_THRESHOLD
    assert task.get("execution_active") is None
    assert task["state"] == "STARTED"
