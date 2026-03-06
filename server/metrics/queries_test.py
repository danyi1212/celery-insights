import pytest
from pytest_mock import MockerFixture

from metrics.queries import (
    query_exceptions_by_type,
    query_table_counts,
    query_task_counts_by_state,
    query_task_runtime_values,
    query_tasks_by_type,
    query_tasks_by_worker,
    query_worker_active_tasks,
    query_worker_counts,
    query_worker_processed_tasks,
)


@pytest.fixture()
def mock_db(mocker: MockerFixture):
    mock = mocker.AsyncMock()
    mocker.patch("metrics.queries.get_db", return_value=mock)
    return mock


class TestQueryTaskCountsByState:
    @pytest.mark.asyncio
    async def test_returns_rows_direct_format(self, mock_db):
        mock_db.query.return_value = [{"state": "SUCCESS", "count": 5}, {"state": "FAILURE", "count": 2}]
        result = await query_task_counts_by_state()
        assert result == [{"state": "SUCCESS", "count": 5}, {"state": "FAILURE", "count": 2}]

    @pytest.mark.asyncio
    async def test_returns_rows_nested_format(self, mock_db):
        mock_db.query.return_value = [[{"state": "STARTED", "count": 3}]]
        result = await query_task_counts_by_state()
        assert result == [{"state": "STARTED", "count": 3}]

    @pytest.mark.asyncio
    async def test_returns_empty_on_error(self, mock_db):
        mock_db.query.side_effect = Exception("DB down")
        result = await query_task_counts_by_state()
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_empty_on_empty_result(self, mock_db):
        mock_db.query.return_value = []
        result = await query_task_counts_by_state()
        assert result == []


class TestQueryWorkerCounts:
    @pytest.mark.asyncio
    async def test_returns_worker_status_rows(self, mock_db):
        mock_db.query.return_value = [{"status": "online", "count": 3}, {"status": "offline", "count": 1}]
        result = await query_worker_counts()
        assert result == [{"status": "online", "count": 3}, {"status": "offline", "count": 1}]

    @pytest.mark.asyncio
    async def test_returns_empty_on_error(self, mock_db):
        mock_db.query.side_effect = Exception("DB down")
        result = await query_worker_counts()
        assert result == []


class TestQueryTaskRuntimeValues:
    @pytest.mark.asyncio
    async def test_returns_float_values(self, mock_db):
        mock_db.query.return_value = [{"runtime": 1.5}, {"runtime": 0.3}, {"runtime": 10.0}]
        result = await query_task_runtime_values()
        assert result == [1.5, 0.3, 10.0]

    @pytest.mark.asyncio
    async def test_filters_non_numeric(self, mock_db):
        mock_db.query.return_value = [{"runtime": 1.5}, {"runtime": "bad"}, {"runtime": None}]
        result = await query_task_runtime_values()
        assert result == [1.5]

    @pytest.mark.asyncio
    async def test_returns_empty_on_error(self, mock_db):
        mock_db.query.side_effect = Exception("DB down")
        result = await query_task_runtime_values()
        assert result == []


class TestQueryTasksByType:
    @pytest.mark.asyncio
    async def test_returns_type_rows(self, mock_db):
        mock_db.query.return_value = [{"type": "tasks.add", "count": 10}]
        result = await query_tasks_by_type()
        assert result == [{"type": "tasks.add", "count": 10}]


class TestQueryTasksByWorker:
    @pytest.mark.asyncio
    async def test_returns_worker_rows(self, mock_db):
        mock_db.query.return_value = [{"worker": "worker1@host", "count": 5}]
        result = await query_tasks_by_worker()
        assert result == [{"worker": "worker1@host", "count": 5}]


class TestQueryExceptionsByType:
    @pytest.mark.asyncio
    async def test_returns_exception_rows(self, mock_db):
        mock_db.query.return_value = [{"exception": "ValueError('bad')", "count": 3}]
        result = await query_exceptions_by_type()
        assert result == [{"exception": "ValueError('bad')", "count": 3}]


class TestQueryWorkerActiveTasks:
    @pytest.mark.asyncio
    async def test_returns_active_task_rows(self, mock_db):
        mock_db.query.return_value = [{"worker": "w1@host", "count": 2}]
        result = await query_worker_active_tasks()
        assert result == [{"worker": "w1@host", "count": 2}]


class TestQueryWorkerProcessedTasks:
    @pytest.mark.asyncio
    async def test_returns_processed_task_rows(self, mock_db):
        mock_db.query.return_value = [{"worker": "w1@host", "count": 50}]
        result = await query_worker_processed_tasks()
        assert result == [{"worker": "w1@host", "count": 50}]


class TestQueryTableCounts:
    @pytest.mark.asyncio
    async def test_returns_counts(self, mocker: MockerFixture):
        mocker.patch("metrics.queries.get_db", return_value=mocker.AsyncMock())
        mocker.patch("metrics.queries.query_table_count", side_effect=[100, 5, 500])
        result = await query_table_counts()
        assert result == {"tasks": 100, "workers": 5, "events": 500}

    @pytest.mark.asyncio
    async def test_returns_zeros_on_error(self, mocker: MockerFixture):
        mocker.patch("metrics.queries.get_db", side_effect=RuntimeError("not initialized"))
        result = await query_table_counts()
        assert result == {"tasks": 0, "workers": 0, "events": 0}
