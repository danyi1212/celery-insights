import pytest
from pytest_mock import MockerFixture

from events.connection_manager import ConnectionManager


class FakeWebSocket:
    # noinspection PyMethodMayBeStatic
    async def send_text(self) -> str:
        return ""


def test_connection_manager_subscribe():
    manager = ConnectionManager()
    ws = FakeWebSocket()
    manager.subscribe(ws)  # type: ignore
    assert ws in manager.active_connections


def test_connection_manager_unsubscribe():
    manager = ConnectionManager()
    ws = FakeWebSocket()
    manager.active_connections.append(ws)  # type: ignore
    manager.unsubscribe(ws)  # type: ignore
    assert ws not in manager.active_connections


@pytest.mark.asyncio
async def test_connection_manager_broadcast(mocker: MockerFixture):
    manager = ConnectionManager()
    wss = [FakeWebSocket(), FakeWebSocket()]
    manager.active_connections = wss
    success_mock = mocker.patch.object(wss[0], "send_text")
    error_mock = mocker.patch.object(wss[1], "send_text", side_effect=Exception("test exception"))
    message = "test message"

    await manager.broadcast(message)

    success_mock.assert_called_once_with(message)
    error_mock.assert_called_once_with(message)
