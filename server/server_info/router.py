import asyncio

from fastapi import APIRouter, Body, Request
from fastapi_cache.decorator import cache
from starlette.responses import StreamingResponse

from events.receiver import state
from server_info.debug_bundle import create_debug_bundle
from server_info.models import ClientDebugInfo, ClientInfo, ServerInfo, UserAgentInfo
from settings import Settings
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
def clear_state(force: bool = False) -> bool:
    state.clear(ready=not force)
    return True


@settings_router.post("/download-debug-bundle")
async def download_debug_bundle(request: Request, client_info: ClientDebugInfo = Body(...)):
    settings = Settings()
    browser = get_user_agent(request)
    buffer = await create_debug_bundle(settings, browser, client_info)
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=debug_bundle.zip"}
    )


def get_user_agent(request: Request) -> UserAgentInfo:
    user_agent_string = request.headers.get("User-Agent")
    browser = UserAgentInfo.parse(user_agent_string)
    return browser
