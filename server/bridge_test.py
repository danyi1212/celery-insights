from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from bridge import BridgeCallerGate


@pytest.fixture
def client(mocker):
    mocker.patch("bridge.get_settings", return_value=SimpleNamespace(bridge_token="private-process-credential"))
    app = FastAPI()
    app.add_middleware(BridgeCallerGate)

    @app.get("/bridge/status")
    def status():
        return {"ingestion": "ready"}

    return TestClient(app)


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"X-Celery-Bridge-Token": "wrong"},
        {"Cookie": "__Host-ci_session=user-session", "Authorization": "Bearer user-token", "X-User-Id": "admin"},
        [("X-Celery-Bridge-Token", "private-process-credential"), ("X-Celery-Bridge-Token", "wrong")],
    ],
)
def test_bridge_rejects_untrusted_callers(client, headers):
    response = client.get("/bridge/status", headers=headers)
    assert response.status_code == 403
    assert "private-process-credential" not in response.text


def test_private_process_credential_allows_bridge_status(client):
    assert client.get("/bridge/status", headers={"X-Celery-Bridge-Token": "private-process-credential"}).json() == {
        "ingestion": "ready"
    }


def test_bridge_does_not_expose_application_websockets(client):
    with (
        pytest.raises(WebSocketDisconnect) as caught,
        client.websocket_connect("/ws", headers={"X-Celery-Bridge-Token": "private-process-credential"}),
    ):
        pytest.fail("Private bridge must not accept application WebSockets")
    assert caught.value.code == 1008
