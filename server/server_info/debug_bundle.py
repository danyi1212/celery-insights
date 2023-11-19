import asyncio
import logging
import zipfile
from io import BytesIO

from aiopath import AsyncPath
from pydantic import BaseModel

from logging_config import LOG_FILE_PATH
from settings import Settings

logger = logging.getLogger(__name__)


def dump_model(file: zipfile.ZipFile, filename: str, model: BaseModel) -> None:
    settings_json = model.model_dump_json(indent=4)
    file.writestr(filename, settings_json)


async def dump_file(file: zipfile.ZipFile, filename: str, path: AsyncPath) -> None:
    if not await path.is_file():
        logger.info(f"Unable to find file at {path.name!r}, skipping...")
        return

    content = await path.read_text(encoding="utf-8")
    file.writestr(filename, content)


async def create_debug_bundle(settings: Settings) -> BytesIO:
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as file:
        async with asyncio.TaskGroup() as tg:
            tg.create_task(dump_file(file, "config.py", AsyncPath(settings.config_path)))
            tg.create_task(dump_file(file, "app.log", AsyncPath(LOG_FILE_PATH)))
            dump_model(file, "settings.json", settings)

    buffer.seek(0)
    return buffer
