import asyncio
import logging
import zipfile
from io import BytesIO
from typing import Any

from aiopath import AsyncPath
from pydantic_core import to_json
from starlette.requests import Request

from events.receiver import state
from logging_config import LOG_FILE_PATH
from server_info.models import ClientDebugInfo, StateDump
from settings import Settings
from tasks.model import Task
from workers.models import Worker
from ws.managers import events_manager
from ws.models import ClientInfo, UserAgentInfo

logger = logging.getLogger(__name__)


def dump_model(file: zipfile.ZipFile, filename: str, model: Any) -> None:
    settings_json = to_json(model, indent=4)
    file.writestr(filename, settings_json)


async def dump_file(file: zipfile.ZipFile, filename: str, path: AsyncPath) -> None:
    if not await path.is_file():
        logger.info(f"Unable to find file at {path.name!r}, skipping...")
        return

    content = await path.read_text(encoding="utf-8")
    file.writestr(filename, content)


async def generate_bundle_file(settings: Settings, browser: UserAgentInfo | None,
                               client_info: ClientDebugInfo, connections: list[ClientInfo],
                               state_dump: StateDump) -> BytesIO:
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as file:
        async with asyncio.TaskGroup() as tg:
            tg.create_task(dump_file(file, "config.py", AsyncPath(settings.config_path)))
            tg.create_task(dump_file(file, "app.log", AsyncPath(LOG_FILE_PATH)))
            dump_model(file, "settings.json", settings)
            dump_model(file, "browser.json", browser)
            dump_model(file, "client.json", client_info)
            dump_model(file, "connections.json", connections)
            dump_model(file, "state.json", state_dump)

    buffer.seek(0)
    return buffer


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


async def create_debug_bundle(request: Request, client_info: ClientDebugInfo) -> BytesIO:
    settings = Settings()
    browser = get_user_agent(request)
    connections = list(events_manager.get_clients())
    state_dump = get_state_dump()
    return await generate_bundle_file(settings, browser, client_info, connections, state_dump)
