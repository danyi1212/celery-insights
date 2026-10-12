"""Checks that benchmark validation can reject incomplete observations."""

import json
import asyncio
from argparse import Namespace
from unittest.mock import AsyncMock

import pytest

from tooling.benchmark.pipeline import distribution, validate, validate_existing, scheduled_seconds


def observations():
    return (
        [
            {
                "id": "task:bench-0",
                "state": "SUCCESS",
                "result": "'benchmark-result-0'",
                "result_truncated": False,
                "workflow_id": "bench-0",
            }
        ],
        [{"data": json.dumps({"bench_sequence": sequence})} for sequence in [0, 1, 2, 3]],
        [{"id": "workflow:bench-0", "task_count": 1, "aggregate_state": "SUCCESS"}],
    )


def test_complete_literal_fixture_passes():
    tasks, events, workflows = observations()
    assert validate(tasks, events, workflows, 1, 0) == []


def test_burst_schedule_preserves_arrival_spacing_and_returns_to_steady_rate():
    assert scheduled_seconds(100, 20) == 5
    assert scheduled_seconds(99, 20, 100, 2, 5) == 4.95
    assert scheduled_seconds(100, 20, 100, 2, 5) == 5
    assert scheduled_seconds(200, 20, 100, 2, 5) == 6
    assert scheduled_seconds(300, 20, 100, 2, 5) == 7
    assert scheduled_seconds(320, 20, 100, 2, 5) == 8


@pytest.mark.parametrize("missing_history", [False, True])
def test_restart_requires_raw_history_not_only_final_results(monkeypatch, missing_history):
    tasks, events, workflows = observations()
    database = AsyncMock()
    rows = [tasks, events[1:] if missing_history else events, workflows]
    index = 0

    async def response(*_):
        nonlocal index
        row = rows[index % 3]
        index += 1
        return {"result": [{"status": "OK", "result": row}]}

    database.query_raw.side_effect = response
    monkeypatch.setenv("BENCH_DB_URL", "ws://unused/rpc")
    monkeypatch.setenv("BENCH_WRITER_PASSWORD", "private-fixture")
    monkeypatch.setattr("tooling.benchmark.pipeline.AsyncSurreal", lambda _: database)
    report = asyncio.run(validate_existing(Namespace(tasks=1, result_bytes=0, drain_seconds=0.005)))
    assert report["status"] == ("failed" if missing_history else "passed")
    if missing_history:
        assert report["validatedDataMs"] is None
        assert any("coverage" in error for error in report["errors"])
    else:
        assert report["events"] == 4
    assert database.close.await_count >= 1


def test_missing_event_is_not_hidden_by_correct_final_state():
    tasks, events, workflows = observations()
    assert any("coverage" in problem for problem in validate(tasks, events[1:], workflows, 1, 0))


def test_duplicate_event_does_not_pass_matching_count():
    tasks, events, workflows = observations()
    events[0] = events[1]
    assert any("coverage" in problem for problem in validate(tasks, events, workflows, 1, 0))


def test_corrupt_result_and_workflow_are_reported():
    tasks, events, workflows = observations()
    tasks[0]["result"] = "wrong"
    workflows[0]["task_count"] = 2
    assert len(validate(tasks, events, workflows, 1, 0)) == 2


def test_absent_samples_and_small_samples_do_not_invent_tail_latency():
    assert distribution([])["p50"] is None
    assert distribution([2, 5, 1])["p50"] == 2
    assert distribution([2, 5, 1])["p99"] is None
