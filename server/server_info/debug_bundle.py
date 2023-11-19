import asyncio
import logging
import zipfile
from io import BytesIO

from aiopath import AsyncPath

from settings import Settings

logger = logging.getLogger(__name__)


def dump_settings(file: zipfile.ZipFile, settings: Settings) -> None:
    settings_json = settings.model_dump_json(indent=4)
    file.writestr("settings.json", settings_json)


async def dump_config(file: zipfile.ZipFile, config_path: AsyncPath) -> None:
    if not await config_path.is_file():
        logger.info("Unable to find Celery config file, skipping...")
        return

    content = await config_path.read_text(encoding="utf-8")
    file.writestr("config.py", content)


async def create_debug_bundle(settings: Settings) -> BytesIO:
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as file:
        async with asyncio.TaskGroup() as tg:
            tg.create_task(dump_config(file, AsyncPath(settings.config_path)))
            dump_settings(file, settings)

    buffer.seek(0)
    return buffer
