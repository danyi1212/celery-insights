import asyncio
import logging
import zipfile
from io import BytesIO
from typing import Any

from aiopath import AsyncPath
from pydantic_core import to_json

from logging_config import LOG_FILE_PATH
from server_info.models import ClientDebugInfo
from settings import Settings
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


async def create_debug_bundle(settings: Settings, browser: UserAgentInfo | None,
                              client_info: ClientDebugInfo, connections: list[ClientInfo]) -> BytesIO:
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as file:
        async with asyncio.TaskGroup() as tg:
            tg.create_task(dump_file(file, "config.py", AsyncPath(settings.config_path)))
            tg.create_task(dump_file(file, "app.log", AsyncPath(LOG_FILE_PATH)))
            dump_model(file, "settings.json", settings)
            dump_model(file, "browser.json", browser)
            dump_model(file, "client.json", client_info)
            dump_model(file, "connections.json", connections)

    buffer.seek(0)
    return buffer
