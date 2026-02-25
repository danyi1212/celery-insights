from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from server_info.models import ServerInfo


class TestServerInfoCreate:
    @pytest.fixture()
    def mock_db(self, mocker: MockerFixture):
        mock = mocker.AsyncMock()
        mocker.patch("server_info.models.get_db", return_value=mock)
        return mock

    @pytest.fixture()
    def mock_request(self):
        request = MagicMock()
        request.url.hostname = "localhost"
        request.url.port = 8556
        request.app.version = "1.0.0"
        return request

    @pytest.mark.asyncio
    async def test_queries_surrealdb_for_counts(self, mock_db, mock_request):
        mock_db.query.side_effect = [
            [{"count": 42}],
            [{"count": 5}],
        ]

        info = await ServerInfo.create(mock_request)

        assert info.task_count == 42
        assert info.worker_count == 5
        assert mock_db.query.call_count == 2
        assert "task" in mock_db.query.call_args_list[0][0][0]
        assert "worker" in mock_db.query.call_args_list[1][0][0]

    @pytest.mark.asyncio
    async def test_returns_zero_counts_on_empty_results(self, mock_db, mock_request):
        mock_db.query.side_effect = [[], []]

        info = await ServerInfo.create(mock_request)

        assert info.task_count == 0
        assert info.worker_count == 0

    @pytest.mark.asyncio
    async def test_returns_zero_counts_on_surrealdb_error(self, mock_db, mock_request):
        mock_db.query.side_effect = Exception("SurrealDB down")

        info = await ServerInfo.create(mock_request)

        assert info.task_count == 0
        assert info.worker_count == 0

    @pytest.mark.asyncio
    async def test_returns_zero_when_db_not_initialized(self, mocker: MockerFixture, mock_request):
        mocker.patch("server_info.models.get_db", side_effect=RuntimeError("not initialized"))

        info = await ServerInfo.create(mock_request)

        assert info.task_count == 0
        assert info.worker_count == 0

    @pytest.mark.asyncio
    async def test_populates_system_info(self, mock_db, mock_request):
        mock_db.query.side_effect = [[], []]

        info = await ServerInfo.create(mock_request)

        assert info.server_hostname == "localhost"
        assert info.server_port == 8556
        assert info.server_version == "1.0.0"
        assert info.uptime > 0
