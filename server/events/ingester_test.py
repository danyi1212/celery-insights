import asyncio
import json

import pytest
from pytest_mock import MockerFixture

from events.ingester import (
    BACKPRESSURE_THRESHOLD,
    SurrealDBIngester,
    build_children_update,
    build_raw_event,
    build_task_upsert,
    build_workflow_membership_upsert,
    build_workflow_summary_recompute,
    build_worker_upsert,
)


class TestBuildTaskUpsert:
    def test_task_sent(self):
        event = {
            "type": "task-sent",
            "uuid": "abc-123",
            "timestamp": 1700000000.0,
            "name": "myapp.tasks.add",
            "args": "(1, 2)",
            "kwargs": "{}",
            "retries": 0,
            "root_id": "abc-123",
        }
        query, params = build_task_upsert(event, 0)

        assert "UPSERT type::record('task', $t0_id)" in query
        assert "state = IF $t0_apply THEN $t0_state ELSE $t0_previous.state END" in query
        assert "sent_at = IF $t0_previous.sent_at IS NONE" in query
        assert params["t0_id"] == "abc-123"
        assert params["t0_state"] == "PENDING"
        assert params["t0_type"] == "myapp.tasks.add"
        assert params["t0_args"] == "(1, 2)"
        assert params["t0_retries"] == 0
        assert params["t0_workflow_id"] == "abc-123"

    def test_task_started_with_worker(self):
        event = {
            "type": "task-started",
            "uuid": "abc-123",
            "timestamp": 1700000001.0,
            "hostname": "worker1@host",
        }
        query, params = build_task_upsert(event, 5)

        assert "$t5_id" in query
        assert "started_at = IF $t5_previous.started_at IS NONE" in query
        assert params["t5_state"] == "STARTED"
        assert params["t5_worker"] == "worker1@host"
        assert params["t5_workflow_id"] == "abc-123"

    def test_task_succeeded_with_result(self):
        event = {
            "type": "task-succeeded",
            "uuid": "abc-123",
            "timestamp": 1700000002.0,
            "result": "42",
            "runtime": 1.5,
        }
        query, params = build_task_upsert(event, 0)

        assert "succeeded_at" in query
        assert params["t0_state"] == "SUCCESS"
        assert params["t0_result"] == "42"
        assert params["t0_runtime"] == 1.5

    def test_task_failed_with_exception(self):
        event = {
            "type": "task-failed",
            "uuid": "abc-123",
            "timestamp": 1700000002.0,
            "exception": "ValueError('bad')",
            "traceback": "Traceback...",
        }
        _query, params = build_task_upsert(event, 0)

        assert params["t0_state"] == "FAILURE"
        assert params["t0_exception"] == "ValueError('bad')"
        assert params["t0_traceback"] == "Traceback..."

    def test_out_of_order_protection_in_state(self):
        query, _ = build_task_upsert({"type": "task-received", "uuid": "x", "timestamp": 1700000000.0}, 0)
        assert (
            "LET $t0_apply = $t0_previous.last_updated IS NONE OR <datetime>$t0_ts > $t0_previous.last_updated; "
            in query
        )
        assert "state = IF $t0_apply THEN $t0_state ELSE $t0_previous.state END" in query
        assert "last_updated_observed" not in query.split("LET $t0_apply")[1].split(";")[0]

    def test_out_of_order_protection_in_last_updated(self):
        query, _ = build_task_upsert({"type": "task-received", "uuid": "x", "timestamp": 1700000000.0}, 0)
        assert "last_updated = IF $t0_apply THEN <datetime>$t0_ts ELSE $t0_previous.last_updated END" in query
        assert (
            "last_updated_observed = IF $t0_apply THEN false ELSE $t0_previous.last_updated_observed ?? false END"
            in query
        )

    def test_workflow_follows_root_id_freshness(self):
        query, _ = build_task_upsert({"type": "task-sent", "uuid": "x", "timestamp": 1700000000.0, "root_id": "r"}, 0)
        assert (
            "workflow_id = IF $t0_previous.root_id IS NONE OR $t0_apply"
            " OR <datetime>$t0_ts >= $t0_previous.last_updated"
            " THEN $t0_workflow_id ELSE $t0_previous.workflow_id ?? $t0_workflow_id END"
        ) in query

    def test_moving_workflow_drops_emptied_previous_workflow(self):
        query, _ = build_task_upsert({"type": "task-sent", "uuid": "x", "timestamp": 1700000000.0, "root_id": "r"}, 0)
        assert (
            "DELETE type::record('workflow', $t0_previous.workflow_id ?? $t0_workflow_id)"
            " WHERE $t0_previous.workflow_id != NONE AND $t0_previous.workflow_id != $t0_workflow_id"
        ) in query
        query, _ = build_task_upsert({"type": "task-started", "uuid": "x", "timestamp": 1700000000.0}, 0)
        assert "DELETE" not in query

    def test_metadata_fills_missing_fields_from_older_events_only(self):
        event = {
            "type": "task-sent",
            "uuid": "x",
            "timestamp": 1700000000.0,
            "root_id": "r",
            "parent_id": "p",
            "routing_key": "reports",
            "hostname": "worker-1",
        }
        query, params = build_task_upsert(event, 0)
        for field in ("root_id", "parent_id", "routing_key", "worker"):
            assert (
                f"{field} = IF $t0_previous.{field} IS NONE OR $t0_apply"
                f" OR <datetime>$t0_ts >= $t0_previous.last_updated"
                f" THEN $t0_{field} ELSE $t0_previous.{field} END"
            ) in query
        assert params["t0_root_id"] == "r"
        assert params["t0_parent_id"] == "p"
        assert params["t0_routing_key"] == "reports"
        assert params["t0_worker"] == "worker-1"

    def test_terminal_event_replaces_observed_non_terminal_or_same_state(self):
        query, _ = build_task_upsert({"type": "task-succeeded", "uuid": "x", "timestamp": 1700000000.0}, 0)
        assert (
            "LET $t0_apply = $t0_previous.last_updated IS NONE OR <datetime>$t0_ts > $t0_previous.last_updated"
            " OR ($t0_previous.last_updated_observed = true AND ($t0_previous.state NOT IN"
            " ['SUCCESS', 'FAILURE', 'REVOKED', 'REJECTED', 'IGNORED'] OR $t0_previous.state = $t0_state)); "
        ) in query

    def test_timestamp_field_keeps_earliest(self):
        query, _ = build_task_upsert({"type": "task-started", "uuid": "x", "timestamp": 1700000000.0}, 0)
        assert "started_at = IF $t0_previous.started_at IS NONE OR <datetime>$t0_ts < $t0_previous.started_at" in query

    def test_missing_uuid_returns_empty(self):
        query, params = build_task_upsert({"type": "task-sent", "timestamp": 1700000000.0}, 0)
        assert query == ""
        assert params == {}

    def test_unknown_event_type_returns_empty(self):
        query, params = build_task_upsert({"type": "task-custom", "uuid": "abc", "timestamp": 1700000000.0}, 0)
        assert query == ""
        assert params == {}

    def test_missing_timestamp_returns_empty(self):
        query, params = build_task_upsert({"type": "task-sent", "uuid": "abc"}, 0)
        assert query == ""
        assert params == {}

    def test_unique_param_prefix_per_index(self):
        _, params_0 = build_task_upsert({"type": "task-sent", "uuid": "a", "timestamp": 1700000000.0}, 0)
        _, params_7 = build_task_upsert({"type": "task-sent", "uuid": "b", "timestamp": 1700000000.0}, 7)
        assert "t0_id" in params_0
        assert "t7_id" in params_7
        assert set(params_0.keys()).isdisjoint(params_7.keys())


class TestBuildChildrenUpdate:
    def test_task_received_with_parent(self):
        event = {
            "type": "task-received",
            "uuid": "child-1",
            "parent_id": "parent-1",
            "timestamp": 1700000000.0,
        }
        query, params = build_children_update(event, 0)

        assert "array::union" in query
        assert "type::record('task', $ch0_parent)" in query
        assert params["ch0_parent"] == "parent-1"
        assert params["ch0_child"] == "child-1"

    def test_task_sent_with_parent(self):
        event = {
            "type": "task-sent",
            "uuid": "child-1",
            "parent_id": "parent-1",
            "timestamp": 1700000000.0,
        }
        query, _ = build_children_update(event, 0)
        assert query != ""

    def test_no_parent_returns_empty(self):
        event = {"type": "task-received", "uuid": "task-1", "timestamp": 1700000000.0}
        query, params = build_children_update(event, 0)
        assert query == ""
        assert params == {}

    def test_non_creation_event_returns_empty(self):
        event = {
            "type": "task-started",
            "uuid": "child-1",
            "parent_id": "parent-1",
            "timestamp": 1700000000.0,
        }
        query, _params = build_children_update(event, 0)
        assert query == ""


class TestBuildWorkflowMembershipUpsert:
    def test_builds_workflow_and_edge_upserts(self):
        event = {
            "type": "task-started",
            "uuid": "child-1",
            "root_id": "root-1",
            "timestamp": 1700000000.0,
        }

        query, params = build_workflow_membership_upsert(event, 0)

        assert "UPSERT type::record('workflow', $wfrel0_workflow_id)" in query
        assert "RELATE OR UPDATE" in query
        assert "->(type::record('workflow_task', $wfrel0_edge_id))" in query
        assert params["wfrel0_workflow_id"] == "root-1"
        assert params["wfrel0_task_id"] == "child-1"
        assert params["wfrel0_edge_id"] == "root-1:child-1"

    def test_uses_task_id_for_single_task_workflow(self):
        event = {
            "type": "task-started",
            "uuid": "solo-1",
            "timestamp": 1700000000.0,
        }

        _query, params = build_workflow_membership_upsert(event, 0)

        assert params["wfrel0_workflow_id"] == "solo-1"


class TestBuildWorkflowSummaryRecompute:
    def test_recomputes_summary_for_workflow(self):
        event = {
            "type": "task-failed",
            "uuid": "child-1",
            "root_id": "root-1",
            "timestamp": 1700000000.0,
        }

        query, params = build_workflow_summary_recompute(event, 0)

        assert "LET $wfs0_task_count = " in query
        assert "FROM task WHERE workflow_id = $wfs0_workflow_id" in query
        assert "aggregate_state = IF $wfs0_failure_count > 0 THEN 'FAILURE'" in query
        assert "latest_exception_preview = $wfs0_latest_exception" in query
        assert params["wfs0_workflow_id"] == "root-1"
        assert sorted(params["wfs0_active_states"]) == ["PENDING", "RECEIVED", "STARTED"]


class TestBuildWorkerUpsert:
    def test_worker_online(self):
        event = {
            "type": "worker-online",
            "hostname": "celery@host1",
            "timestamp": 1700000000.0,
            "sw_ident": "py-celery",
            "sw_ver": "5.4.0",
        }
        query, params = build_worker_upsert(event, 0)

        assert "UPSERT type::record('worker', $w0_id)" in query
        assert "$w0_status" in query
        assert "missed_polls" in query
        assert params["w0_id"] == "celery@host1"
        assert params["w0_status"] == "online"
        assert params["w0_sw_ident"] == "py-celery"

    def test_worker_offline(self):
        event = {
            "type": "worker-offline",
            "hostname": "celery@host1",
            "timestamp": 1700000000.0,
        }
        _, params = build_worker_upsert(event, 0)
        assert params["w0_status"] == "offline"

    def test_worker_heartbeat(self):
        event = {
            "type": "worker-heartbeat",
            "hostname": "celery@host1",
            "timestamp": 1700000000.0,
            "active": 3,
            "processed": 100,
        }
        _query, params = build_worker_upsert(event, 0)
        assert params["w0_status"] == "online"
        assert params["w0_active"] == 3
        assert params["w0_processed"] == 100

    def test_skips_internal_fields(self):
        event = {
            "type": "worker-online",
            "hostname": "celery@host1",
            "timestamp": 1700000000.0,
            "clock": 42,
            "local_received": 1700000000.1,
        }
        _, params = build_worker_upsert(event, 0)
        assert "w0_clock" not in params
        assert "w0_local_received" not in params

    def test_missing_hostname_returns_empty(self):
        query, params = build_worker_upsert({"type": "worker-online", "timestamp": 1.0}, 0)
        assert query == ""
        assert params == {}

    def test_missing_timestamp_returns_empty(self):
        query, params = build_worker_upsert({"type": "worker-online", "hostname": "h"}, 0)
        assert query == ""
        assert params == {}


class TestBuildRawEvent:
    def test_task_event(self):
        event = {"type": "task-sent", "uuid": "abc-123", "timestamp": 1700000000.0}
        query, params = build_raw_event(event, 0)

        assert "CREATE event SET" in query
        assert params["e0_type"] == "task-sent"
        assert params["e0_task_id"] == "abc-123"
        assert json.loads(params["e0_data"]) == event

    def test_worker_event(self):
        event = {"type": "worker-online", "hostname": "celery@host1", "timestamp": 1700000000.0}
        query, params = build_raw_event(event, 0)

        assert "hostname = $e0_hostname" in query
        assert params["e0_hostname"] == "celery@host1"
        assert "task_id" not in query

    def test_missing_type_returns_empty(self):
        query, params = build_raw_event({"timestamp": 1700000000.0}, 0)
        assert query == ""
        assert params == {}

    def test_missing_timestamp_returns_empty(self):
        query, params = build_raw_event({"type": "task-sent"}, 0)
        assert query == ""
        assert params == {}


class TestSurrealDBIngester:
    @pytest.fixture()
    def mock_db(self, mocker: MockerFixture):
        mock = mocker.AsyncMock()
        mock.query_raw.return_value = {"result": [{"status": "OK", "result": []}]}
        mocker.patch("events.ingester.get_db", return_value=mock)
        return mock

    @pytest.fixture()
    def queue(self):
        return asyncio.Queue()

    @pytest.mark.asyncio
    async def test_flush_executes_batch_query(self, mock_db, queue):
        ingester = SurrealDBIngester(queue)
        ingester._buffer = [
            {"type": "task-sent", "uuid": "abc", "timestamp": 1700000000.0, "name": "my.task"},
        ]

        await ingester._flush()

        mock_db.query_raw.assert_called_once()
        query_str = mock_db.query_raw.call_args[0][0]
        assert "BEGIN TRANSACTION" in query_str
        assert "COMMIT TRANSACTION" in query_str
        assert "UPSERT type::record('task'" in query_str
        assert "UPSERT type::record('workflow'" in query_str
        assert "->(type::record('workflow_task'" in query_str
        assert "RELATE OR UPDATE" in query_str
        assert "CREATE event SET" in query_str

    @pytest.mark.asyncio
    async def test_terminal_events_trigger_callback(self, mock_db, queue, mocker: MockerFixture):  # noqa: ARG002
        callback = mocker.AsyncMock()
        ingester = SurrealDBIngester(queue, on_terminal=callback)
        ingester._buffer = [
            {"type": "task-succeeded", "uuid": "abc-123", "timestamp": 1700000000.0},
        ]

        await ingester._flush()

        callback.assert_called_once_with(["abc-123"])

    @pytest.mark.asyncio
    async def test_non_terminal_events_skip_callback(self, mock_db, queue, mocker: MockerFixture):  # noqa: ARG002
        callback = mocker.AsyncMock()
        ingester = SurrealDBIngester(queue, on_terminal=callback)
        ingester._buffer = [
            {"type": "task-started", "uuid": "abc-123", "timestamp": 1700000000.0},
        ]

        await ingester._flush()

        callback.assert_not_called()

    @pytest.mark.asyncio
    async def test_multiple_terminal_events(self, mock_db, queue, mocker: MockerFixture):  # noqa: ARG002
        callback = mocker.AsyncMock()
        ingester = SurrealDBIngester(queue, on_terminal=callback)
        ingester._buffer = [
            {"type": "task-succeeded", "uuid": "task-1", "timestamp": 1700000000.0},
            {"type": "task-failed", "uuid": "task-2", "timestamp": 1700000001.0},
        ]

        await ingester._flush()

        callback.assert_called_once_with(["task-1", "task-2"])

    @pytest.mark.asyncio
    async def test_backpressure_drops_incoming_event(self, mock_db, queue):  # noqa: ARG002
        ingester = SurrealDBIngester(queue)
        ingester._buffer = [
            {"type": "task-sent", "uuid": f"task-{i}", "timestamp": 1700000000.0 + i}
            for i in range(BACKPRESSURE_THRESHOLD)
        ]

        # Put a new event into the queue and run one iteration of the consume loop
        new_event = {"type": "task-sent", "uuid": "new-task", "timestamp": 2000000000.0}
        await queue.put(new_event)

        ingester.start()
        # Give the consume loop time to process the event
        await asyncio.sleep(0.1)
        await ingester.stop()

        # The incoming event should have been dropped (buffer stays at threshold)
        assert len(ingester._buffer) == BACKPRESSURE_THRESHOLD
        assert ingester._dropped_count == 1
        # Buffer should contain only original events (new-task was dropped)
        assert ingester._buffer[0]["uuid"] == "task-0"
        assert ingester._buffer[-1]["uuid"] == f"task-{BACKPRESSURE_THRESHOLD - 1}"

    @pytest.mark.asyncio
    async def test_flush_clears_buffer_and_terminal_flag(self, mock_db, queue):  # noqa: ARG002
        ingester = SurrealDBIngester(queue)
        ingester._buffer = [
            {"type": "task-succeeded", "uuid": "abc", "timestamp": 1700000000.0},
        ]
        ingester._has_terminal = True

        await ingester._flush()

        assert ingester._buffer == []
        assert ingester._has_terminal is False

    @pytest.mark.asyncio
    async def test_flush_handles_db_error_gracefully(self, mock_db, queue):
        mock_db.query_raw.side_effect = Exception("Connection lost")
        ingester = SurrealDBIngester(queue)
        events = [
            {"type": "task-sent", "uuid": "abc", "timestamp": 1700000000.0},
        ]
        ingester._buffer = list(events)

        await ingester._flush()

        # Events are re-queued for retry on failure
        assert ingester._buffer == events

    @pytest.mark.asyncio
    async def test_later_statement_failure_requeues_events(self, mock_db, queue, mocker: MockerFixture):
        mock_db.query_raw.return_value = {
            "result": [
                {"status": "OK", "result": []},
                {"status": "ERR", "result": "relation constraint failed"},
            ]
        }
        callback = mocker.AsyncMock()
        ingester = SurrealDBIngester(queue, on_terminal=callback)
        events = [{"type": "task-succeeded", "uuid": "abc", "timestamp": 1700000000.0}]
        ingester._buffer = list(events)
        await ingester._flush()
        assert ingester._buffer == events
        assert ingester._stats_events_total == 0
        callback.assert_not_called()

    @pytest.mark.asyncio
    async def test_empty_flush_is_noop(self, mock_db, queue):
        ingester = SurrealDBIngester(queue)
        await ingester._flush()
        mock_db.query_raw.assert_not_called()

    @pytest.mark.asyncio
    async def test_mixed_task_and_worker_events(self, mock_db, queue):
        ingester = SurrealDBIngester(queue)
        ingester._buffer = [
            {"type": "task-sent", "uuid": "abc", "timestamp": 1700000000.0},
            {"type": "worker-online", "hostname": "celery@host", "timestamp": 1700000000.0},
        ]

        await ingester._flush()

        query_str = mock_db.query_raw.call_args[0][0]
        assert "type::record('task'" in query_str
        assert "type::record('worker'" in query_str

    @pytest.mark.asyncio
    async def test_children_update_included_in_batch(self, mock_db, queue):
        ingester = SurrealDBIngester(queue)
        ingester._buffer = [
            {
                "type": "task-received",
                "uuid": "child-1",
                "parent_id": "parent-1",
                "timestamp": 1700000000.0,
            },
        ]

        await ingester._flush()

        query_str = mock_db.query_raw.call_args[0][0]
        assert "array::union" in query_str

    @pytest.mark.asyncio
    async def test_stop_sets_event(self, queue):
        ingester = SurrealDBIngester(queue)
        assert not ingester._stop_event.is_set()
        await ingester.stop()
        assert ingester._stop_event.is_set()

    @pytest.mark.asyncio
    async def test_callback_error_does_not_crash(self, mock_db, queue, mocker: MockerFixture):  # noqa: ARG002
        callback = mocker.AsyncMock(side_effect=Exception("callback boom"))
        ingester = SurrealDBIngester(queue, on_terminal=callback)
        ingester._buffer = [
            {"type": "task-succeeded", "uuid": "abc", "timestamp": 1700000000.0},
        ]

        await ingester._flush()

        callback.assert_called_once()

    @pytest.mark.asyncio
    async def test_invalid_events_are_skipped(self, mock_db, queue):
        ingester = SurrealDBIngester(queue)
        ingester._buffer = [
            {},
            {"type": "unknown-event"},
            {"type": "task-sent"},
        ]

        await ingester._flush()

        mock_db.query_raw.assert_not_called()


class TestMcpObservationEvidence:
    def test_later_events_preserve_known_workflow(self):
        event = {"type": "task-succeeded", "uuid": "child", "timestamp": 1700000010.0}
        query, _ = build_task_upsert(event, 0)
        assert "workflow_id = $t0_previous.workflow_id ?? $t0_workflow_id" in query
        membership, _ = build_workflow_membership_upsert(event, 0)
        summary, _ = build_workflow_summary_recompute(event, 0)
        assert "SELECT VALUE workflow_id FROM type::record('task', $wfrel0_task_id)" in membership
        assert "SELECT VALUE workflow_id FROM type::record('task', $wfs0_task_id)" in summary

    def test_errors_survive_success_and_observation_time_keeps_earliest(self):
        failure, _ = build_task_upsert(
            {"type": "task-retried", "uuid": "child", "timestamp": 1700000000.0, "exception": "TimeoutError()"}, 0
        )
        success, _ = build_task_upsert({"type": "task-succeeded", "uuid": "child", "timestamp": 1700000010.0}, 1)
        assert "had_error = true" in failure
        assert "had_error = false" not in success
        assert "<datetime>$t1_ts < $t1_previous.first_observed_at" in success

    def test_intentional_retry_does_not_imply_error(self):
        query, _ = build_task_upsert({"type": "task-retried", "uuid": "child", "timestamp": 1700000000.0}, 0)
        assert "had_error = true" not in query
