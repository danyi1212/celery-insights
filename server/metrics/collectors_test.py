import asyncio
from unittest.mock import AsyncMock

import pytest
from pytest_mock import MockerFixture

from metrics.collectors import collect_tier1, collect_tier2, collect_tier3


@pytest.fixture(autouse=True)
def _mock_queries(mocker: MockerFixture):
    mocker.patch("metrics.collectors.query_task_counts_by_state", new_callable=AsyncMock, return_value=[])
    mocker.patch("metrics.collectors.query_worker_counts", new_callable=AsyncMock, return_value=[])
    mocker.patch("metrics.collectors.query_task_runtime_values", new_callable=AsyncMock, return_value=[])
    mocker.patch("metrics.collectors.query_tasks_by_type", new_callable=AsyncMock, return_value=[])
    mocker.patch("metrics.collectors.query_tasks_by_worker", new_callable=AsyncMock, return_value=[])
    mocker.patch("metrics.collectors.query_runtime_by_type", new_callable=AsyncMock, return_value=[])
    mocker.patch("metrics.collectors.query_exceptions_by_type", new_callable=AsyncMock, return_value=[])
    mocker.patch("metrics.collectors.query_worker_active_tasks", new_callable=AsyncMock, return_value=[])
    mocker.patch("metrics.collectors.query_worker_processed_tasks", new_callable=AsyncMock, return_value=[])
    mocker.patch(
        "metrics.collectors.query_table_counts",
        new_callable=AsyncMock,
        return_value={"tasks": 0, "workers": 0, "events": 0},
    )


class TestCollectTier1:
    @pytest.mark.asyncio
    async def test_returns_bytes(self):
        result = await collect_tier1()
        assert isinstance(result, bytes)

    @pytest.mark.asyncio
    async def test_contains_core_metrics(self, mocker: MockerFixture):
        mocker.patch(
            "metrics.collectors.query_task_counts_by_state",
            new_callable=AsyncMock,
            return_value=[{"state": "SUCCESS", "count": 10}, {"state": "FAILURE", "count": 2}],
        )
        mocker.patch(
            "metrics.collectors.query_worker_counts",
            new_callable=AsyncMock,
            return_value=[{"status": "online", "count": 3}, {"status": "offline", "count": 1}],
        )
        mocker.patch(
            "metrics.collectors.query_task_runtime_values",
            new_callable=AsyncMock,
            return_value=[0.5, 1.2, 3.0],
        )

        result = (await collect_tier1()).decode()

        assert "celery_tasks_total 12.0" in result
        assert 'celery_tasks_by_state{state="SUCCESS"} 10.0' in result
        assert 'celery_tasks_by_state{state="FAILURE"} 2.0' in result
        assert "celery_workers_total 4.0" in result
        assert "celery_workers_online 3.0" in result
        assert "celery_workers_offline 1.0" in result
        assert "celery_task_runtime_seconds_bucket" in result
        assert "celery_tasks_succeeded_total 10.0" in result
        assert "celery_tasks_failed_total 2.0" in result
        assert "celery_tasks_retried_total 0.0" in result

    @pytest.mark.asyncio
    async def test_empty_data(self):
        result = (await collect_tier1()).decode()
        assert "celery_tasks_total 0.0" in result
        assert "celery_workers_total 0.0" in result


class TestCollectTier2:
    @pytest.mark.asyncio
    async def test_returns_bytes(self):
        result = await collect_tier2()
        assert isinstance(result, bytes)

    @pytest.mark.asyncio
    async def test_contains_tier2_metrics(self, mocker: MockerFixture):
        mocker.patch(
            "metrics.collectors.query_tasks_by_type",
            new_callable=AsyncMock,
            return_value=[{"type": "tasks.add", "count": 5}],
        )
        mocker.patch(
            "metrics.collectors.query_tasks_by_worker",
            new_callable=AsyncMock,
            return_value=[{"worker": "w1@host", "count": 8}],
        )
        mocker.patch(
            "metrics.collectors.query_exceptions_by_type",
            new_callable=AsyncMock,
            return_value=[{"exception": "ValueError('x')", "count": 1}],
        )
        mocker.patch(
            "metrics.collectors.query_worker_active_tasks",
            new_callable=AsyncMock,
            return_value=[{"worker": "w1@host", "count": 2}],
        )
        mocker.patch(
            "metrics.collectors.query_worker_processed_tasks",
            new_callable=AsyncMock,
            return_value=[{"worker": "w1@host", "count": 50}],
        )

        result = (await collect_tier2()).decode()

        # Tier 1 metrics still present
        assert "celery_tasks_total" in result

        # Tier 2 metrics
        assert 'celery_tasks_by_type{task_type="tasks.add"} 5.0' in result
        assert 'celery_tasks_by_worker{worker="w1@host"} 8.0' in result
        assert "celery_exceptions_by_type" in result
        assert 'celery_worker_active_tasks{worker="w1@host"} 2.0' in result
        assert 'celery_worker_processed_tasks{worker="w1@host"} 50.0' in result

    @pytest.mark.asyncio
    async def test_runtime_by_type_histogram(self, mocker: MockerFixture):
        mocker.patch(
            "metrics.collectors.query_runtime_by_type",
            new_callable=AsyncMock,
            return_value=[
                {"type": "tasks.add", "runtime": 0.5},
                {"type": "tasks.add", "runtime": 1.0},
            ],
        )

        result = (await collect_tier2()).decode()
        assert "celery_task_runtime_seconds_by_type_bucket" in result


class TestCollectTier3:
    @pytest.mark.asyncio
    async def test_returns_bytes_without_ingester(self):
        result = await collect_tier3(None)
        assert isinstance(result, bytes)

    @pytest.mark.asyncio
    async def test_contains_system_metrics(self):
        result = (await collect_tier3(None)).decode()
        assert "celery_insights_uptime_seconds" in result
        assert "celery_insights_memory_rss_bytes" in result
        assert "celery_insights_db_tasks_count" in result
        assert "celery_insights_db_workers_count" in result
        assert "celery_insights_db_events_count" in result

    @pytest.mark.asyncio
    async def test_contains_cpu_load(self):
        result = (await collect_tier3(None)).decode()
        assert 'celery_insights_cpu_load{interval="1m"}' in result
        assert 'celery_insights_cpu_load{interval="5m"}' in result
        assert 'celery_insights_cpu_load{interval="15m"}' in result

    @pytest.mark.asyncio
    async def test_ingester_stats(self, mocker: MockerFixture):
        mocker.patch(
            "metrics.collectors.query_table_counts",
            new_callable=AsyncMock,
            return_value={"tasks": 100, "workers": 5, "events": 500},
        )

        ingester = mocker.MagicMock()
        ingester._stats_events_total = 1000
        ingester._dropped_count = 5
        ingester._stats_flushes_total = 200
        ingester._buffer = [1, 2, 3]
        ingester.queue = asyncio.Queue()

        result = (await collect_tier3(ingester)).decode()

        assert "celery_insights_events_ingested_total 1000.0" in result
        assert "celery_insights_events_dropped_total 5.0" in result
        assert "celery_insights_flushes_total 200.0" in result
        assert "celery_insights_buffer_size 3.0" in result
        assert "celery_insights_queue_size 0.0" in result
        assert "celery_insights_db_tasks_count 100.0" in result
        assert "celery_insights_db_workers_count 5.0" in result
        assert "celery_insights_db_events_count 500.0" in result
