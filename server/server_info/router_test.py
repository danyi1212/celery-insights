from typing import Any, cast

import pytest
from pytest_mock import MockerFixture

from server_info.router import clear_state


def make_request(*, debug_snapshot_mode: bool) -> Any:
    return cast(
        Any,
        type(
            "Req",
            (),
            {"app": type("App", (), {"state": type("State", (), {"debug_snapshot_mode": debug_snapshot_mode})()})()},
        )(),
    )


class TestClearState:
    @pytest.fixture()
    def mock_db(self, mocker: MockerFixture):
        mock = mocker.AsyncMock()
        mocker.patch("server_info.router.get_db", return_value=mock)
        return mock

    @pytest.mark.asyncio
    async def test_truncates_all_tables(self, mock_db):
        request = make_request(debug_snapshot_mode=False)
        result = await clear_state(request)

        assert result is True
        mock_db.query.assert_called_once()
        query = mock_db.query.call_args[0][0]
        assert "DELETE FROM task" in query
        assert "DELETE FROM event" in query
        assert "DELETE FROM worker" in query

    @pytest.mark.asyncio
    async def test_returns_false_on_error(self, mock_db):
        mock_db.query.side_effect = Exception("SurrealDB down")
        request = make_request(debug_snapshot_mode=False)

        result = await clear_state(request)

        assert result is False

    @pytest.mark.asyncio
    async def test_returns_false_when_db_not_initialized(self, mocker: MockerFixture):
        mocker.patch("server_info.router.get_db", side_effect=RuntimeError("not initialized"))
        request = make_request(debug_snapshot_mode=False)

        result = await clear_state(request)

        assert result is False

    @pytest.mark.asyncio
    async def test_returns_conflict_in_snapshot_mode(self, mock_db):  # noqa: ARG002
        request = make_request(debug_snapshot_mode=True)

        result = await clear_state(request)

        assert result.status_code == 409
