import pytest
from pytest_mock import MockerFixture

from tasks.result_fetcher import RESULT_SIZE_LIMIT, ResultFetcher, _fetch_result_sync, _truncate_result


class TestTruncateResult:
    def test_short_string_not_truncated(self):
        value, truncated = _truncate_result("hello")
        assert value == "hello"
        assert truncated is False

    def test_exact_limit_not_truncated(self):
        value = "x" * RESULT_SIZE_LIMIT
        result, truncated = _truncate_result(value)
        assert len(result) == RESULT_SIZE_LIMIT
        assert truncated is False

    def test_over_limit_truncated(self):
        value = "x" * (RESULT_SIZE_LIMIT + 100)
        result, truncated = _truncate_result(value)
        assert len(result) == RESULT_SIZE_LIMIT
        assert truncated is True

    def test_empty_string(self):
        value, truncated = _truncate_result("")
        assert value == ""
        assert truncated is False


class TestFetchResultSync:
    def test_success_result(self, mocker: MockerFixture):
        mock_async_result = mocker.MagicMock()
        mock_async_result.result = 42
        mock_async_result.traceback = None
        mocker.patch("tasks.result_fetcher.AsyncResult", return_value=mock_async_result)

        celery_app = mocker.MagicMock()
        data = _fetch_result_sync("task-123", celery_app)

        assert data["result"] == "42"
        assert data["result_truncated"] is False
        assert "traceback" not in data
        assert "exception" not in data

    def test_failure_result_with_exception(self, mocker: MockerFixture):
        exc = ValueError("something went wrong")
        mock_async_result = mocker.MagicMock()
        mock_async_result.result = exc
        mock_async_result.traceback = "Traceback (most recent call last):\n  ..."
        mocker.patch("tasks.result_fetcher.AsyncResult", return_value=mock_async_result)

        celery_app = mocker.MagicMock()
        data = _fetch_result_sync("task-456", celery_app)

        assert "result" in data
        assert data["traceback"] == "Traceback (most recent call last):\n  ..."
        assert "ValueError" in data["exception"]
        assert "something went wrong" in data["exception"]

    def test_none_result_returns_empty(self, mocker: MockerFixture):
        mock_async_result = mocker.MagicMock()
        mock_async_result.result = None
        mock_async_result.traceback = None
        mocker.patch("tasks.result_fetcher.AsyncResult", return_value=mock_async_result)

        celery_app = mocker.MagicMock()
        data = _fetch_result_sync("task-789", celery_app)

        assert data == {}

    def test_large_result_truncated(self, mocker: MockerFixture):
        large_value = "x" * (RESULT_SIZE_LIMIT + 500)
        mock_async_result = mocker.MagicMock()
        mock_async_result.result = large_value
        mock_async_result.traceback = None
        mocker.patch("tasks.result_fetcher.AsyncResult", return_value=mock_async_result)

        celery_app = mocker.MagicMock()
        data = _fetch_result_sync("task-big", celery_app)

        assert data["result_truncated"] is True
        assert len(data["result"]) == RESULT_SIZE_LIMIT

    def test_traceback_without_exception_type(self, mocker: MockerFixture):
        mock_async_result = mocker.MagicMock()
        mock_async_result.result = "some result"
        mock_async_result.traceback = "some traceback"
        mocker.patch("tasks.result_fetcher.AsyncResult", return_value=mock_async_result)

        celery_app = mocker.MagicMock()
        data = _fetch_result_sync("task-tb", celery_app)

        assert data["result"] == "'some result'"
        assert data["traceback"] == "some traceback"
        assert "exception" not in data


class TestResultFetcher:
    @pytest.fixture()
    def mock_db(self, mocker: MockerFixture):
        mock = mocker.AsyncMock()
        mocker.patch("tasks.result_fetcher.get_db", return_value=mock)
        return mock

    @pytest.fixture()
    def celery_app(self, mocker: MockerFixture):
        return mocker.MagicMock()

    @pytest.mark.asyncio
    async def test_fetch_and_store_success(self, mock_db, celery_app, mocker: MockerFixture):
        mock_async_result = mocker.MagicMock()
        mock_async_result.result = 42
        mock_async_result.traceback = None
        mocker.patch("tasks.result_fetcher.AsyncResult", return_value=mock_async_result)

        fetcher = ResultFetcher(celery_app)
        await fetcher.fetch_and_store(["task-1"])

        mock_db.query.assert_called_once()
        query_str = mock_db.query.call_args[0][0]
        assert "UPDATE type::record('task', $task_id)" in query_str
        assert "result = $result" in query_str
        params = mock_db.query.call_args[0][1]
        assert params["task_id"] == "task-1"
        assert params["result"] == "42"
        assert params["result_truncated"] is False

    @pytest.mark.asyncio
    async def test_fetch_and_store_multiple_tasks(self, mock_db, celery_app, mocker: MockerFixture):
        mock_async_result = mocker.MagicMock()
        mock_async_result.result = "ok"
        mock_async_result.traceback = None
        mocker.patch("tasks.result_fetcher.AsyncResult", return_value=mock_async_result)

        fetcher = ResultFetcher(celery_app)
        await fetcher.fetch_and_store(["task-1", "task-2", "task-3"])

        assert mock_db.query.call_count == 3

    @pytest.mark.asyncio
    async def test_fetch_and_store_handles_backend_error(self, mock_db, celery_app, mocker: MockerFixture):
        mocker.patch("tasks.result_fetcher.AsyncResult", side_effect=Exception("Redis down"))

        fetcher = ResultFetcher(celery_app)
        # Should not raise
        await fetcher.fetch_and_store(["task-1"])

        mock_db.query.assert_not_called()

    @pytest.mark.asyncio
    async def test_fetch_and_store_handles_db_error(self, mock_db, celery_app, mocker: MockerFixture):
        mock_async_result = mocker.MagicMock()
        mock_async_result.result = 42
        mock_async_result.traceback = None
        mocker.patch("tasks.result_fetcher.AsyncResult", return_value=mock_async_result)
        mock_db.query.side_effect = Exception("SurrealDB down")

        fetcher = ResultFetcher(celery_app)
        # Should not raise
        await fetcher.fetch_and_store(["task-1"])

    @pytest.mark.asyncio
    async def test_fetch_and_store_skips_empty_data(self, mock_db, celery_app, mocker: MockerFixture):
        mock_async_result = mocker.MagicMock()
        mock_async_result.result = None
        mock_async_result.traceback = None
        mocker.patch("tasks.result_fetcher.AsyncResult", return_value=mock_async_result)

        fetcher = ResultFetcher(celery_app)
        await fetcher.fetch_and_store(["task-1"])

        mock_db.query.assert_not_called()

    @pytest.mark.asyncio
    async def test_partial_failure_does_not_block_others(self, mock_db, celery_app, mocker: MockerFixture):
        call_count = 0

        def mock_async_result_factory(task_id, app=None):  # noqa: ARG001
            nonlocal call_count
            call_count += 1
            if task_id == "task-bad":
                raise Exception("Backend error")
            mock = mocker.MagicMock()
            mock.result = "ok"
            mock.traceback = None
            return mock

        mocker.patch("tasks.result_fetcher.AsyncResult", side_effect=mock_async_result_factory)

        fetcher = ResultFetcher(celery_app)
        await fetcher.fetch_and_store(["task-1", "task-bad", "task-2"])

        # task-1 and task-2 should succeed, task-bad should fail gracefully
        assert mock_db.query.call_count == 2

    @pytest.mark.asyncio
    async def test_exception_result_stored(self, mock_db, celery_app, mocker: MockerFixture):
        exc = ValueError("bad value")
        mock_async_result = mocker.MagicMock()
        mock_async_result.result = exc
        mock_async_result.traceback = "Traceback..."
        mocker.patch("tasks.result_fetcher.AsyncResult", return_value=mock_async_result)

        fetcher = ResultFetcher(celery_app)
        await fetcher.fetch_and_store(["task-fail"])

        mock_db.query.assert_called_once()
        params = mock_db.query.call_args[0][1]
        assert "exception" in params
        assert "ValueError" in params["exception"]
        assert params["traceback"] == "Traceback..."
