"""Integration tests for metrics endpoints using the real FastAPI app with mocked SurrealDB."""

import asyncio
from unittest.mock import MagicMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from pytest_mock import MockerFixture

from app import app

CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8"


@pytest.fixture(autouse=True)
def _mock_surrealdb(mocker: MockerFixture):
    """Mock SurrealDB to return realistic data for all metrics queries."""
    mock_db = mocker.AsyncMock()

    # Track which queries were made and return appropriate results
    async def mock_query(query_str):
        if "GROUP BY state" in query_str and "task" in query_str:
            return [
                {"state": "SUCCESS", "count": 10},
                {"state": "FAILURE", "count": 2},
                {"state": "STARTED", "count": 1},
            ]
        if "GROUP BY status" in query_str and "worker" in query_str:
            return [{"status": "online", "count": 3}, {"status": "offline", "count": 1}]
        if "SELECT runtime FROM task" in query_str:
            return [{"runtime": 0.5}, {"runtime": 1.2}, {"runtime": 3.0}]
        if "GROUP BY type" in query_str and "task" in query_str:
            return [{"type": "tasks.add", "count": 8}, {"type": "tasks.mul", "count": 5}]
        if "GROUP BY worker" in query_str and "STARTED" not in query_str and "SUCCESS" not in query_str:
            return [{"worker": "worker1@host", "count": 7}, {"worker": "worker2@host", "count": 6}]
        if "type, runtime" in query_str:
            return [{"type": "tasks.add", "runtime": 0.5}, {"type": "tasks.add", "runtime": 1.2}]
        if "GROUP BY exception" in query_str:
            return [{"exception": "ValueError('bad')", "count": 2}]
        if "STARTED" in query_str and "GROUP BY worker" in query_str:
            return [{"worker": "worker1@host", "count": 1}]
        if "SUCCESS" in query_str and "GROUP BY worker" in query_str:
            return [{"worker": "worker1@host", "count": 5}]
        if "GROUP ALL" in query_str:
            return [{"count": 100}]
        return []

    mock_db.query = mock_query
    mocker.patch("metrics.queries.get_db", return_value=mock_db)
    mocker.patch("server_info.models.get_db", return_value=mock_db)

    # Mock the ingester on app.state
    ingester = MagicMock()
    ingester._stats_events_total = 500
    ingester._dropped_count = 3
    ingester._stats_flushes_total = 100
    ingester._buffer = []
    ingester.queue = asyncio.Queue()
    app.state.ingester = ingester


@pytest_asyncio.fixture()
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


class TestMetricsEndpoint:
    @pytest.mark.asyncio
    async def test_returns_200_with_prometheus_content_type(self, client):
        res = await client.get("/metrics")
        assert res.status_code == 200
        assert CONTENT_TYPE in res.headers["content-type"]

    @pytest.mark.asyncio
    async def test_contains_core_metrics(self, client):
        res = await client.get("/metrics")
        body = res.text

        assert "celery_tasks_total 13.0" in body
        assert 'celery_tasks_by_state{state="SUCCESS"} 10.0' in body
        assert 'celery_tasks_by_state{state="FAILURE"} 2.0' in body
        assert "celery_workers_total 4.0" in body
        assert "celery_workers_online 3.0" in body
        assert "celery_workers_offline 1.0" in body
        assert "celery_task_runtime_seconds_bucket" in body
        assert "celery_tasks_succeeded_total 10.0" in body
        assert "celery_tasks_failed_total 2.0" in body

    @pytest.mark.asyncio
    async def test_does_not_contain_verbose_metrics(self, client):
        res = await client.get("/metrics")
        body = res.text

        assert "celery_tasks_by_type" not in body
        assert "celery_tasks_by_worker" not in body
        assert "celery_exceptions_by_type" not in body


class TestMetricsVerboseEndpoint:
    @pytest.mark.asyncio
    async def test_returns_200(self, client):
        res = await client.get("/metrics/verbose")
        assert res.status_code == 200

    @pytest.mark.asyncio
    async def test_contains_core_and_verbose_metrics(self, client):
        res = await client.get("/metrics/verbose")
        body = res.text

        # Core metrics
        assert "celery_tasks_total" in body
        assert "celery_task_runtime_seconds_bucket" in body

        # Verbose metrics
        assert 'celery_tasks_by_type{task_type="tasks.add"} 8.0' in body
        assert 'celery_tasks_by_type{task_type="tasks.mul"} 5.0' in body
        assert "celery_tasks_by_worker" in body
        assert "celery_exceptions_by_type" in body
        assert "celery_worker_active_tasks" in body
        assert "celery_worker_processed_tasks" in body


class TestMetricsSystemEndpoint:
    @pytest.mark.asyncio
    async def test_returns_200(self, client):
        res = await client.get("/metrics/system")
        assert res.status_code == 200

    @pytest.mark.asyncio
    async def test_contains_system_and_ingester_metrics(self, client):
        res = await client.get("/metrics/system")
        body = res.text

        assert "celery_insights_uptime_seconds" in body
        assert "celery_insights_memory_rss_bytes" in body
        assert "celery_insights_events_ingested_total 500.0" in body
        assert "celery_insights_events_dropped_total 3.0" in body
        assert "celery_insights_flushes_total 100.0" in body
        assert "celery_insights_buffer_size 0.0" in body
        assert "celery_insights_queue_size 0.0" in body
        assert "celery_insights_db_tasks_count" in body
        assert "celery_insights_db_workers_count" in body
        assert "celery_insights_db_events_count" in body
