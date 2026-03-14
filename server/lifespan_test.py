from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from lifespan import lifespan


class TestLifespan:
    @pytest.fixture(autouse=True)
    def _setup_mocks(self):
        self.mock_app = MagicMock()

        with (
            patch("lifespan.Settings") as mock_settings_cls,
            patch("lifespan.init_surrealdb", new_callable=AsyncMock) as init_surreal,
            patch("lifespan.close_surrealdb", new_callable=AsyncMock) as close_surreal,
            patch("lifespan.get_celery_app", new_callable=AsyncMock) as get_app,
            patch("lifespan.CeleryEventReceiver") as receiver_cls,
            patch("lifespan.SurrealDBIngester") as ingester_cls,
            patch("lifespan.WorkerPoller") as poller_cls,
            patch("lifespan.CleanupJob") as cleanup_cls,
            patch("lifespan.ResultFetcher") as fetcher_cls,
            patch("lifespan.FastAPICache"),
        ):
            settings = mock_settings_cls.return_value
            settings.timezone = "UTC"
            settings.ingestion_batch_interval_ms = 100
            settings.cleanup_interval_seconds = 60
            settings.task_max_count = None
            settings.task_retention_hours = None
            settings.dead_worker_retention_hours = 24
            settings.debug_snapshot_mode = False

            get_app.return_value = MagicMock()

            receiver_cls.return_value.queue = MagicMock()
            receiver_cls.return_value.start = MagicMock()
            receiver_cls.return_value.stop = MagicMock()

            ingester_cls.return_value.start = MagicMock()
            ingester_cls.return_value.stop = AsyncMock()

            poller_cls.return_value.start = MagicMock()
            poller_cls.return_value.stop = AsyncMock()

            cleanup_cls.return_value.start = MagicMock()
            cleanup_cls.return_value.stop = AsyncMock()

            fetcher_cls.return_value.fetch_and_store = AsyncMock()

            self.settings = settings
            self.init_surrealdb = init_surreal
            self.close_surrealdb = close_surreal
            self.get_celery_app = get_app
            self.receiver_cls = receiver_cls
            self.receiver = receiver_cls.return_value
            self.ingester_cls = ingester_cls
            self.ingester = ingester_cls.return_value
            self.poller = poller_cls.return_value
            self.cleanup_cls = cleanup_cls
            self.cleanup = cleanup_cls.return_value
            self.fetcher_cls = fetcher_cls
            self.fetcher = fetcher_cls.return_value
            yield

    @pytest.mark.asyncio
    async def test_startup_initializes_surrealdb(self):
        async with lifespan(self.mock_app):
            self.init_surrealdb.assert_called_once_with(self.settings)

    @pytest.mark.asyncio
    async def test_startup_connects_celery(self):
        async with lifespan(self.mock_app):
            self.get_celery_app.assert_called_once()

    @pytest.mark.asyncio
    async def test_startup_starts_all_services(self):
        async with lifespan(self.mock_app):
            self.receiver.start.assert_called_once()
            self.ingester.start.assert_called_once()
            self.poller.start.assert_called_once()
            self.cleanup.start.assert_called_once()

    @pytest.mark.asyncio
    async def test_shutdown_stops_services_and_closes_surrealdb(self):
        async with lifespan(self.mock_app):
            pass

        self.cleanup.stop.assert_called_once()
        self.poller.stop.assert_called_once()
        self.ingester.stop.assert_called_once()
        self.receiver.stop.assert_called_once()
        self.close_surrealdb.assert_called_once()

    @pytest.mark.asyncio
    async def test_ingester_receives_event_receiver_queue(self):
        async with lifespan(self.mock_app):
            self.ingester_cls.assert_called_once()
            call_kwargs = self.ingester_cls.call_args
            assert call_kwargs.kwargs["queue"] is self.receiver.queue

    @pytest.mark.asyncio
    async def test_ingester_on_terminal_wired_to_result_fetcher(self):
        async with lifespan(self.mock_app):
            call_kwargs = self.ingester_cls.call_args
            assert call_kwargs.kwargs["on_terminal"] is self.fetcher.fetch_and_store

    @pytest.mark.asyncio
    async def test_cleanup_job_uses_settings(self):
        async with lifespan(self.mock_app):
            self.cleanup_cls.assert_called_once_with(
                interval_seconds=self.settings.cleanup_interval_seconds,
                task_max_count=self.settings.task_max_count,
                task_retention_hours=self.settings.task_retention_hours,
                dead_worker_retention_hours=self.settings.dead_worker_retention_hours,
            )

    @pytest.mark.asyncio
    async def test_exposes_cleanup_job_on_app_state(self):
        async with lifespan(self.mock_app):
            assert self.mock_app.state.cleanup_job is self.cleanup

    @pytest.mark.asyncio
    async def test_snapshot_mode_skips_celery_services(self):
        self.settings.debug_snapshot_mode = True

        async with lifespan(self.mock_app):
            pass

        self.get_celery_app.assert_not_called()
        self.receiver.start.assert_not_called()
        self.ingester.start.assert_not_called()
        self.poller.start.assert_not_called()
        self.cleanup.start.assert_not_called()
        assert self.mock_app.state.debug_snapshot_mode is True
