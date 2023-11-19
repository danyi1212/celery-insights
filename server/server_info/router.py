import asyncio

from fastapi import APIRouter, Body, Request
from fastapi_cache.decorator import cache
from starlette.responses import StreamingResponse

from events.receiver import state
from server_info.debug_bundle import create_debug_bundle
from server_info.models import ClientDebugInfo, ServerInfo
from ws.managers import events_manager
from ws.models import ClientInfo

settings_router = APIRouter(prefix="/api/settings", tags=["settings"])


@settings_router.get("/info")
@cache(1)
async def get_server_info(request: Request) -> ServerInfo:
    return await asyncio.to_thread(lambda: ServerInfo.create(request, state))


@settings_router.get("/clients")
def get_clients() -> list[ClientInfo]:
    return list(events_manager.get_clients())


@settings_router.post("/clear")
def clear_state(*, force: bool = False) -> bool:
    state.clear(ready=not force)
    return True


@settings_router.post("/download-debug-bundle")
async def download_debug_bundle(request: Request, client_info: ClientDebugInfo = Body(...)):  # noqa B008
    buffer = await create_debug_bundle(request, client_info)
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=debug_bundle.zip"}
    )
