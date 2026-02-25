import asyncio
import logging
import zipfile
from io import BytesIO
from typing import Any, NamedTuple

from aiopath import AsyncPath
from pydantic_core import to_json
from starlette.requests import Request

from logging_config import LOG_FILE_PATH
from server_info.models import ClientDebugInfo, ServerInfo, StateDump
from settings import Settings

logger = logging.getLogger(__name__)


def dump_model(file: zipfile.ZipFile, filename: str, model: Any) -> None:
    try:
        settings_json = to_json(model, indent=4)
    except Exception as e:
        logger.exception(f"Failed to dump object {model!r} to file {filename!r}: {e}")
    else:
        file.writestr(filename, settings_json)


async def dump_file(file: zipfile.ZipFile, filename: str, path: AsyncPath) -> None:
    if not await path.is_file():
        logger.info(f"Unable to find file at {path.name!r}, skipping...")
        return

    content = await path.read_text(encoding="utf-8")
    file.writestr(filename, content)


class DebugBundleData(NamedTuple):
    settings: Settings
    log_path: str
    client_info: ClientDebugInfo
    state_dump: StateDump
    server_info: ServerInfo


async def generate_bundle_file(data: DebugBundleData) -> BytesIO:
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as file:
        async with asyncio.TaskGroup() as tg:
            tg.create_task(dump_file(file, "config.py", AsyncPath(data.settings.config_path)))
            tg.create_task(dump_file(file, "app.log", AsyncPath(data.log_path)))
            dump_model(file, "settings.json", data.settings)
            dump_model(file, "client_info.json", data.client_info)
            dump_model(file, "state.json", data.state_dump)
            dump_model(file, "server_info.json", data.server_info)

    buffer.seek(0)
    return buffer


async def create_debug_bundle(request: Request, client_info: ClientDebugInfo) -> BytesIO:
    # TODO(2f): Query SurrealDB for state dump instead of empty lists
    return await generate_bundle_file(
        DebugBundleData(
            settings=Settings(),
            log_path=LOG_FILE_PATH,
            client_info=client_info,
            state_dump=StateDump(tasks=[], workers=[]),
            server_info=ServerInfo.create(request),
        )
    )
