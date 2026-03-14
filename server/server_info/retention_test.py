import pytest
from pytest_mock import MockerFixture
from starlette.responses import JSONResponse

from cleanup import CleanupJob
from server_info.router import get_retention_settings, trigger_cleanup, update_retention_settings
from server_info.models import RetentionSettings


class TestGetRetentionSettings:
    @pytest.fixture()
    def mock_db(self, mocker: MockerFixture):
        mock = mocker.AsyncMock()
        mocker.patch("server_info.router.get_db", return_value=mock)
        return mock

    @pytest.fixture()
    def cleanup_job(self):
        return CleanupJob(
            interval_seconds=60,
            task_max_count=5000,
            task_retention_hours=48.0,
            dead_worker_retention_hours=24.0,
        )

    @pytest.fixture()
    def mock_request(self, mocker: MockerFixture, cleanup_job):
        request = mocker.MagicMock()
        request.app.state.cleanup_job = cleanup_job
        request.app.state.debug_snapshot_mode = False
        return request

    @pytest.mark.asyncio
    async def test_returns_current_settings(self, mock_db, mock_request):
        mock_db.query.return_value = [[{"count": 100}]]

        result = await get_retention_settings(mock_request)

        assert result.settings.cleanup_interval_seconds == 60
        assert result.settings.task_max_count == 5000
        assert result.settings.task_retention_hours == 48.0
        assert result.settings.dead_worker_retention_hours == 24.0

    @pytest.mark.asyncio
    async def test_returns_record_counts(self, mock_db, mock_request):
        mock_db.query.side_effect = [
            [[{"count": 100}]],  # tasks
            [[{"count": 500}]],  # events
            [[{"count": 5}]],  # workers
        ]

        result = await get_retention_settings(mock_request)

        assert result.counts.tasks == 100
        assert result.counts.events == 500
        assert result.counts.workers == 5

    @pytest.mark.asyncio
    async def test_handles_empty_table_counts(self, mock_db, mock_request):
        mock_db.query.return_value = [[]]

        result = await get_retention_settings(mock_request)

        assert result.counts.tasks == 0
        assert result.counts.events == 0
        assert result.counts.workers == 0


class TestUpdateRetentionSettings:
    @pytest.fixture()
    def mock_db(self, mocker: MockerFixture):
        mock = mocker.AsyncMock()
        mocker.patch("server_info.router.get_db", return_value=mock)
        return mock

    @pytest.fixture()
    def cleanup_job(self):
        return CleanupJob(
            interval_seconds=60,
            task_max_count=10000,
            task_retention_hours=None,
            dead_worker_retention_hours=24.0,
        )

    @pytest.fixture()
    def mock_request(self, mocker: MockerFixture, cleanup_job):
        request = mocker.MagicMock()
        request.app.state.cleanup_job = cleanup_job
        request.app.state.debug_snapshot_mode = False
        return request

    @pytest.mark.asyncio
    async def test_updates_cleanup_job_settings(self, mock_db, mock_request, cleanup_job):
        mock_db.query.return_value = [[{"count": 0}]]

        new_settings = RetentionSettings(
            cleanup_interval_seconds=120,
            task_max_count=2000,
            task_retention_hours=72.0,
            dead_worker_retention_hours=None,
        )
        await update_retention_settings(mock_request, new_settings)

        assert cleanup_job.task_max_count == 2000
        assert cleanup_job.task_retention_hours == 72.0
        assert cleanup_job.dead_worker_retention_hours is None
        assert cleanup_job.interval_seconds == 120

    @pytest.mark.asyncio
    async def test_returns_updated_settings(self, mock_db, mock_request):
        mock_db.query.return_value = [[{"count": 50}]]

        new_settings = RetentionSettings(
            cleanup_interval_seconds=30,
            task_max_count=None,
            task_retention_hours=24.0,
            dead_worker_retention_hours=12.0,
        )
        result = await update_retention_settings(mock_request, new_settings)

        assert result.settings.task_max_count is None
        assert result.settings.task_retention_hours == 24.0
        assert result.settings.cleanup_interval_seconds == 30

    @pytest.mark.asyncio
    async def test_can_disable_all_policies(self, mock_db, mock_request, cleanup_job):
        mock_db.query.return_value = [[{"count": 0}]]

        new_settings = RetentionSettings(
            cleanup_interval_seconds=60,
            task_max_count=None,
            task_retention_hours=None,
            dead_worker_retention_hours=None,
        )
        await update_retention_settings(mock_request, new_settings)

        assert cleanup_job.task_max_count is None
        assert cleanup_job.task_retention_hours is None
        assert cleanup_job.dead_worker_retention_hours is None

    @pytest.mark.asyncio
    async def test_returns_conflict_in_snapshot_mode(self, mock_request, cleanup_job):  # noqa: ARG002
        mock_request.app.state.debug_snapshot_mode = True

        result = await update_retention_settings(
            mock_request,
            RetentionSettings(
                cleanup_interval_seconds=60,
                task_max_count=None,
                task_retention_hours=None,
                dead_worker_retention_hours=None,
            ),
        )

        assert isinstance(result, JSONResponse)
        assert result.status_code == 409


class TestTriggerCleanup:
    @pytest.fixture()
    def mock_db(self, mocker: MockerFixture):
        mock = mocker.AsyncMock()
        mocker.patch("server_info.router.get_db", return_value=mock)
        return mock

    @pytest.fixture()
    def cleanup_job(self, mocker: MockerFixture):
        job = CleanupJob()
        mocker.patch.object(job, "_run_cleanup", new_callable=mocker.AsyncMock)
        return job

    @pytest.fixture()
    def mock_request(self, mocker: MockerFixture, cleanup_job):
        request = mocker.MagicMock()
        request.app.state.cleanup_job = cleanup_job
        request.app.state.debug_snapshot_mode = False
        return request

    @pytest.mark.asyncio
    async def test_triggers_cleanup_and_returns_success(self, mock_db, mock_request, cleanup_job):
        mock_db.query.return_value = [[{"count": 10}]]

        result = await trigger_cleanup(mock_request)

        assert result["success"] is True
        assert "counts" in result
        cleanup_job._run_cleanup.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_returns_counts_after_cleanup(self, mock_db, mock_request):
        mock_db.query.side_effect = [
            [[{"count": 50}]],  # tasks
            [[{"count": 200}]],  # events
            [[{"count": 3}]],  # workers
        ]

        result = await trigger_cleanup(mock_request)

        assert result["counts"]["tasks"] == 50
        assert result["counts"]["events"] == 200
        assert result["counts"]["workers"] == 3

    @pytest.mark.asyncio
    async def test_returns_failure_on_error(self, mock_db, mock_request, cleanup_job):  # noqa: ARG002
        cleanup_job._run_cleanup.side_effect = Exception("Cleanup failed")

        result = await trigger_cleanup(mock_request)

        assert result["success"] is False
        assert "error" in result

    @pytest.mark.asyncio
    async def test_returns_conflict_in_snapshot_mode(self, mock_request, cleanup_job):  # noqa: ARG002
        mock_request.app.state.debug_snapshot_mode = True

        result = await trigger_cleanup(mock_request)

        assert isinstance(result, JSONResponse)
        assert result.status_code == 409
