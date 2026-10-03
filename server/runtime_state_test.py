from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from runtime_state import apply_retention, first_row, read_ingestion_stats, save_retention
from server_info.models import RetentionSettings


@pytest.mark.parametrize("result", [None, [], [[]], ["unexpected"]])
def test_missing_shared_state(result):
    assert first_row(result) is None


@pytest.mark.parametrize("nested", [False, True])
@pytest.mark.asyncio
async def test_reads_shared_stats_with_both_sdk_response_shapes(mocker, nested):
    row = {"queue_size": 2, "buffer_size": 3, "dropped_events": 4, "events_ingested_total": 100, "flushes_total": 8}
    db = SimpleNamespace(query=AsyncMock(return_value=[[row]] if nested else [row]))
    mocker.patch("runtime_state.get_db", return_value=db)
    stats = await read_ingestion_stats()
    assert stats is not None
    assert stats.events_ingested_total == 100
    assert stats.queue_size == 2
    assert "updated_at > time::now() - 15s" in db.query.call_args.args[0]


@pytest.mark.asyncio
async def test_retention_round_trip_updates_an_independent_worker(mocker):
    settings = RetentionSettings(
        cleanup_interval_seconds=30, task_max_count=500, task_retention_hours=48, dead_worker_retention_hours=72
    )
    db = SimpleNamespace(query=AsyncMock(return_value=[]))
    mocker.patch("runtime_state.get_db", return_value=db)
    await save_retention(settings)
    persisted = db.query.call_args.args[1]["settings"]
    db.query.return_value = [{"id": "runtime_state:retention", **persisted}]
    worker = SimpleNamespace(
        interval_seconds=60, task_max_count=None, task_retention_hours=None, dead_worker_retention_hours=24
    )
    await apply_retention(worker)
    assert worker.interval_seconds == 30
    assert worker.task_max_count == 500
    assert worker.task_retention_hours == 48
    assert worker.dead_worker_retention_hours == 72
