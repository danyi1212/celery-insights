import asyncio

import pytest
from pytest_mock import MockerFixture

from workers.poller import MISSED_POLLS_THRESHOLD, WorkerPoller, _inspect_sync


class TestInspectSync:
    def test_combines_data_from_all_calls(self, mocker: MockerFixture):
        mock_inspect = mocker.MagicMock()
        mock_inspect.stats.return_value = {"worker1@host": {"pid": 123, "clock": 1}}
        mock_inspect.active.return_value = {"worker1@host": []}
        mock_inspect.registered.return_value = {"worker1@host": ["tasks.add"]}
        mock_inspect.scheduled.return_value = {"worker1@host": []}
        mock_inspect.reserved.return_value = {"worker1@host": []}
        mock_inspect.active_queues.return_value = {"worker1@host": [{"name": "celery"}]}

        mock_app = mocker.MagicMock()
        mock_app.control.inspect.return_value = mock_inspect

        result = _inspect_sync(mock_app)

        assert "worker1@host" in result
        assert result["worker1@host"]["stats"] == {"pid": 123, "clock": 1}
        assert result["worker1@host"]["active"] == []
        assert result["worker1@host"]["registered"] == ["tasks.add"]
        assert result["worker1@host"]["active_queues"] == [{"name": "celery"}]

    def test_handles_partial_inspect_failures(self, mocker: MockerFixture):
        mock_inspect = mocker.MagicMock()
        mock_inspect.stats.return_value = {"worker1@host": {"pid": 123}}
        mock_inspect.active.side_effect = Exception("timeout")
        mock_inspect.registered.return_value = {"worker1@host": ["tasks.add"]}
        mock_inspect.scheduled.return_value = {}
        mock_inspect.reserved.return_value = {}
        mock_inspect.active_queues.return_value = {}

        mock_app = mocker.MagicMock()
        mock_app.control.inspect.return_value = mock_inspect

        result = _inspect_sync(mock_app)

        assert "worker1@host" in result
        assert "stats" in result["worker1@host"]
        assert "active" not in result["worker1@host"]

    def test_returns_empty_when_no_workers(self, mocker: MockerFixture):
        mock_inspect = mocker.MagicMock()
        mock_inspect.stats.return_value = None
        mock_inspect.active.return_value = None
        mock_inspect.registered.return_value = None
        mock_inspect.scheduled.return_value = None
        mock_inspect.reserved.return_value = None
        mock_inspect.active_queues.return_value = None

        mock_app = mocker.MagicMock()
        mock_app.control.inspect.return_value = mock_inspect

        result = _inspect_sync(mock_app)
        assert result == {}

    def test_multiple_workers(self, mocker: MockerFixture):
        mock_inspect = mocker.MagicMock()
        mock_inspect.stats.return_value = {
            "worker1@host": {"pid": 1},
            "worker2@host": {"pid": 2},
        }
        mock_inspect.active.return_value = {"worker1@host": []}
        mock_inspect.registered.return_value = {}
        mock_inspect.scheduled.return_value = {}
        mock_inspect.reserved.return_value = {}
        mock_inspect.active_queues.return_value = {}

        mock_app = mocker.MagicMock()
        mock_app.control.inspect.return_value = mock_inspect

        result = _inspect_sync(mock_app)

        assert "worker1@host" in result
        assert "worker2@host" in result
        assert result["worker1@host"]["stats"] == {"pid": 1}
        assert result["worker1@host"]["active"] == []
        assert result["worker2@host"]["stats"] == {"pid": 2}


class TestWorkerPoller:
    @pytest.fixture()
    def mock_db(self, mocker: MockerFixture):
        mock = mocker.AsyncMock()
        mocker.patch("workers.poller.get_db", return_value=mock)
        return mock

    @pytest.fixture()
    def celery_app(self, mocker: MockerFixture):
        return mocker.MagicMock()

    @pytest.mark.asyncio
    async def test_poll_upserts_online_workers(self, mock_db, celery_app, mocker: MockerFixture):
        mocker.patch(
            "workers.poller.asyncio.to_thread",
            return_value={"worker1@host": {"stats": {"pid": 123}}},
        )
        mock_db.query.return_value = [[]]

        poller = WorkerPoller(celery_app)
        await poller._poll()

        # First call: upsert the worker, second call: query existing workers
        assert mock_db.query.call_count == 2

        upsert_call = mock_db.query.call_args_list[0]
        query_str = upsert_call[0][0]
        params = upsert_call[0][1]
        assert "UPSERT" in query_str
        assert "status = 'online'" in query_str
        assert "missed_polls = 0" in query_str
        assert params["id"] == "worker1@host"

    @pytest.mark.asyncio
    async def test_poll_increments_missed_polls_for_missing_workers(self, mock_db, celery_app, mocker: MockerFixture):
        mocker.patch("workers.poller.asyncio.to_thread", return_value={})
        mock_db.query.return_value = [
            [{"id": "worker:stale@host", "missed_polls": 0}],
        ]

        poller = WorkerPoller(celery_app)
        await poller._poll()

        # First call: query existing, second call: update missed_polls
        assert mock_db.query.call_count == 2
        update_call = mock_db.query.call_args_list[1]
        query_str = update_call[0][0]
        params = update_call[0][1]
        assert "missed_polls = $missed" in query_str
        assert params["missed"] == 1
        assert "status = 'offline'" not in query_str

    @pytest.mark.asyncio
    async def test_poll_marks_offline_after_threshold(self, mock_db, celery_app, mocker: MockerFixture):
        mocker.patch("workers.poller.asyncio.to_thread", return_value={})
        mock_db.query.return_value = [
            [{"id": "worker:gone@host", "missed_polls": MISSED_POLLS_THRESHOLD - 1}],
        ]

        poller = WorkerPoller(celery_app)
        await poller._poll()

        update_call = mock_db.query.call_args_list[1]
        query_str = update_call[0][0]
        params = update_call[0][1]
        assert "status = 'offline'" in query_str
        assert params["missed"] == MISSED_POLLS_THRESHOLD

    @pytest.mark.asyncio
    async def test_poll_skips_responding_workers_in_offline_check(self, mock_db, celery_app, mocker: MockerFixture):
        mocker.patch(
            "workers.poller.asyncio.to_thread",
            return_value={"alive@host": {"stats": {"pid": 1}}},
        )
        mock_db.query.return_value = [
            [{"id": "worker:alive@host", "missed_polls": 2}],
        ]

        poller = WorkerPoller(celery_app)
        await poller._poll()

        # Calls: 1 upsert for alive@host + 1 query for existing workers = 2
        # No update for alive@host in offline detection since it responded
        assert mock_db.query.call_count == 2

    @pytest.mark.asyncio
    async def test_poll_handles_inspect_error(self, celery_app, mocker: MockerFixture):
        mocker.patch("workers.poller.asyncio.to_thread", side_effect=Exception("Broker down"))

        poller = WorkerPoller(celery_app)
        # Should not raise
        await poller._poll()

    @pytest.mark.asyncio
    async def test_poll_handles_upsert_error(self, mock_db, celery_app, mocker: MockerFixture):
        mocker.patch(
            "workers.poller.asyncio.to_thread",
            return_value={"worker1@host": {"stats": {"pid": 1}}},
        )
        mock_db.query.side_effect = Exception("SurrealDB down")

        poller = WorkerPoller(celery_app)
        # Should not raise
        await poller._poll()

    @pytest.mark.asyncio
    async def test_poll_handles_query_existing_error(self, mock_db, celery_app, mocker: MockerFixture):
        mocker.patch("workers.poller.asyncio.to_thread", return_value={})
        mock_db.query.side_effect = Exception("SurrealDB down")

        poller = WorkerPoller(celery_app)
        # Should not raise
        await poller._poll()

    def test_start_creates_task(self, celery_app, mocker: MockerFixture):
        mock_create_task = mocker.patch("workers.poller.asyncio.create_task")

        poller = WorkerPoller(celery_app)
        poller.start()

        mock_create_task.assert_called_once()

    @pytest.mark.asyncio
    async def test_stop_sets_event_and_cancels(self, celery_app):
        poller = WorkerPoller(celery_app)
        poller._task = asyncio.create_task(asyncio.sleep(999))
        await poller.stop()

        assert poller._stop_event.is_set()
        assert poller._task.cancelled()

    @pytest.mark.asyncio
    async def test_poll_loop_stops_on_event(self, mock_db, celery_app, mocker: MockerFixture):
        mocker.patch("workers.poller.asyncio.to_thread", return_value={})
        mock_db.query.return_value = [[]]

        poller = WorkerPoller(celery_app, poll_interval=1)
        poller._stop_event.set()
        # Should exit after one iteration since stop event is set
        await poller._poll_loop()
