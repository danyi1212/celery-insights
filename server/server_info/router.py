import asyncio
import logging

from fastapi import APIRouter, Body, Request
from fastapi_cache.decorator import cache
from starlette.responses import StreamingResponse

from events.receiver import state
from server_info.debug_bundle import create_debug_bundle_file
from server_info.models import ClientDebugInfo, ServerInfo, StateDump
from settings import Settings
from tasks.model import Task
from workers.models import Worker
from ws.managers import events_manager
from ws.models import ClientInfo, UserAgentInfo

logger = logging.getLogger(__name__)

settings_router = APIRouter(prefix="/api/settings", tags=["settings"])


@settings_router.get("/info")
@cache(1)
async def get_server_info(request: Request) -> ServerInfo:
    return await asyncio.to_thread(lambda: ServerInfo.create(request, state))


@settings_router.get("/clients")
def get_clients() -> list[ClientInfo]:
    return list(events_manager.get_clients())


@settings_router.post("/clear")
def clear_state(force: bool = False) -> bool:
    state.clear(ready=not force)
    return True


@settings_router.post("/download-debug-bundle")
async def download_debug_bundle(request: Request, client_info: ClientDebugInfo = Body(...)):
    settings = Settings()
    browser = get_user_agent(request)
    connections = list(events_manager.get_clients())
    state_dump = get_state_dump()
    buffer = await create_debug_bundle_file(settings, browser, client_info, connections, state_dump)
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=debug_bundle.zip"}
    )


def get_user_agent(request: Request) -> UserAgentInfo | None:
    user_agent_string = request.headers.get("User-Agent")
    if user_agent_string:
        return
    try:
        return UserAgentInfo.parse(user_agent_string)
    except Exception as e:
        logger.exception(f"Failed to parse user agent header {user_agent_string!r}: {e}")
        return


def get_state_dump() -> StateDump:
    return StateDump(
        tasks=[Task.from_celery_task(task) for _, task in state.tasks_by_time()],
        workers=[Worker.from_celery_worker(worker) for worker in state.workers.itervalues()],
    )
