import asyncio

from fastapi import APIRouter, Request
from fastapi_cache.decorator import cache

from events.receiver import state
from server_info.models import ClientInfo, ServerInfo
from ws.managers import events_manager

settings_router = APIRouter(prefix="/api/settings", tags=["settings"])


@settings_router.get("/info")
@cache(1)
async def get_server_info(request: Request) -> ServerInfo:
    return await asyncio.to_thread(lambda: ServerInfo.create(request, state))


@settings_router.get("/clients")
def get_clients() -> list[ClientInfo]:
    return [
        ClientInfo.from_websocket(client)
        for client in events_manager.active_connections
    ]


@settings_router.post("/clear")
def clear_state(*, force: bool = False) -> bool:
    state.clear(ready=not force)
    return True
