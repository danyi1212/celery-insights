from fastapi import APIRouter

from server_info.models import ClientInfo
from ws.managers import events_manager

settings_router = APIRouter(prefix="/api/settings", tags=["settings"])


@settings_router.get("/clients")
def get_clients() -> list[ClientInfo]:
    return [
        ClientInfo.from_websocket(client)
        for client in events_manager.active_connections
    ]
