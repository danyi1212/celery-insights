from types import SimpleNamespace
from typing import cast

import pytest
from pytest_mock import MockerFixture
from starlette.requests import Request

from server_info.models import ServerInfo
from settings import Settings


class TestServerInfoCreate:
    @pytest.fixture()
    def mock_db(self, mocker: MockerFixture):
        mock = mocker.AsyncMock()
        mocker.patch("server_info.models.get_db", return_value=mock)
        return mock

    @pytest.fixture()
    def mock_request(self):
        return cast(
            Request,
            SimpleNamespace(
                url=SimpleNamespace(hostname="localhost", port=8556),
                app=SimpleNamespace(
                    version="1.0.0",
                    state=SimpleNamespace(
                        settings=Settings(
                            timezone="Asia/Jerusalem",
                            surrealdb_url="ws://surreal.internal:8557/rpc",
                            surrealdb_namespace="ci",
                            surrealdb_database="observability",
                            surrealdb_storage="memory",
                        ),
                        ingester=SimpleNamespace(
                            _buffer=[{"type": "task-sent"}],
                            queue=SimpleNamespace(qsize=lambda: 3),
                            _dropped_count=2,
                            _stats_events_total=144,
                            _stats_flushes_total=12,
                        ),
                    ),
                ),
            ),
        )

    @pytest.mark.asyncio
    async def test_queries_surrealdb_for_counts(self, mock_db, mock_request):
        mock_db.query.side_effect = [
            [{"count": 42}],
            [{"count": 5}],
            [{"count": 9001}],
        ]

        info = await ServerInfo.create(mock_request)

        assert info.task_count == 42
        assert info.worker_count == 5
        assert info.event_count == 9001
        assert mock_db.query.call_count == 3
        assert "task" in mock_db.query.call_args_list[0][0][0]
        assert "worker" in mock_db.query.call_args_list[1][0][0]
        assert "event" in mock_db.query.call_args_list[2][0][0]

    @pytest.mark.asyncio
    async def test_returns_zero_counts_on_empty_results(self, mock_db, mock_request):
        mock_db.query.side_effect = [[], [], []]

        info = await ServerInfo.create(mock_request)

        assert info.task_count == 0
        assert info.worker_count == 0
        assert info.event_count == 0

    @pytest.mark.asyncio
    async def test_returns_zero_counts_on_surrealdb_error(self, mock_db, mock_request):
        mock_db.query.side_effect = Exception("SurrealDB down")

        info = await ServerInfo.create(mock_request)

        assert info.task_count == 0
        assert info.worker_count == 0
        assert info.event_count == 0

    @pytest.mark.asyncio
    async def test_returns_zero_when_db_not_initialized(self, mocker: MockerFixture, mock_request):
        mocker.patch("server_info.models.get_db", side_effect=RuntimeError("not initialized"))

        info = await ServerInfo.create(mock_request)

        assert info.task_count == 0
        assert info.worker_count == 0
        assert info.event_count == 0

    @pytest.mark.asyncio
    async def test_populates_system_info(self, mock_db, mock_request):
        mock_db.query.side_effect = [[], [], []]

        info = await ServerInfo.create(mock_request)

        assert info.server_hostname == "localhost"
        assert info.server_port == 8556
        assert info.server_version == "1.0.0"
        assert info.uptime > 0
        assert info.timezone == "Asia/Jerusalem"
        assert info.surrealdb.endpoint == "ws://surreal.internal:8557/rpc"
        assert info.surrealdb.namespace == "ci"
        assert info.surrealdb.database == "observability"
        assert info.surrealdb.topology == "embedded"
        assert info.surrealdb.durability == "memory"
        assert info.ingestion.batch_interval_ms == 100
        assert info.ingestion.queue_size == 3
        assert info.ingestion.buffer_size == 1
        assert info.ingestion.dropped_events == 2
        assert info.ingestion.events_ingested_total == 144
        assert info.ingestion.flushes_total == 12

    @pytest.mark.asyncio
    async def test_external_surrealdb_marks_durability_as_external(self, mock_db):
        request = cast(
            Request,
            SimpleNamespace(
                url=SimpleNamespace(hostname="localhost", port=8556),
                app=SimpleNamespace(
                    version="1.0.0",
                    state=SimpleNamespace(
                        settings=Settings(
                            surrealdb_url="wss://surreal.example.com/rpc",
                            surrealdb_external_url="wss://surreal.example.com/rpc",
                            surrealdb_namespace="prod",
                            surrealdb_database="shared",
                            surrealdb_storage="memory",
                        ),
                        ingester=None,
                    ),
                ),
            ),
        )
        mock_db.query.side_effect = [[], [], []]

        info = await ServerInfo.create(request)

        assert info.surrealdb.topology == "external"
        assert info.surrealdb.durability == "external"
        assert info.surrealdb.storage is None
