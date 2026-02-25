import asyncio
import json
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
from surrealdb_client import get_db

logger = logging.getLogger(__name__)


def dump_model(file: zipfile.ZipFile, filename: str, model: Any) -> None:
    try:
        settings_json = to_json(model, indent=4)
    except Exception as e:
        logger.exception(f"Failed to dump object {model!r} to file {filename!r}: {e}")
    else:
        file.writestr(filename, settings_json)


def dump_json(file: zipfile.ZipFile, filename: str, data: Any) -> None:
    try:
        file.writestr(filename, json.dumps(data, indent=4, default=str))
    except Exception as e:
        logger.exception(f"Failed to dump JSON to file {filename!r}: {e}")


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
            dump_json(file, "state.json", {"tasks": data.state_dump.tasks, "workers": data.state_dump.workers})
            dump_model(file, "server_info.json", data.server_info)

    buffer.seek(0)
    return buffer


async def _query_state_dump() -> StateDump:
    """Query SurrealDB for all tasks and workers to include in the debug bundle."""
    tasks: list[dict] = []
    workers: list[dict] = []
    try:
        db = get_db()
        task_result = await db.query("SELECT * FROM task")
        if task_result and isinstance(task_result, list):
            tasks = task_result  # ty: ignore[invalid-assignment]
        worker_result = await db.query("SELECT * FROM worker")
        if worker_result and isinstance(worker_result, list):
            workers = worker_result  # ty: ignore[invalid-assignment]
    except Exception:
        logger.exception("Failed to query SurrealDB for debug bundle state dump")
    return StateDump(tasks=tasks, workers=workers)


async def create_debug_bundle(request: Request, client_info: ClientDebugInfo) -> BytesIO:
    state_dump = await _query_state_dump()
    server_info = await ServerInfo.create(request)
    return await generate_bundle_file(
        DebugBundleData(
            settings=Settings(),
            log_path=LOG_FILE_PATH,
            client_info=client_info,
            state_dump=state_dump,
            server_info=server_info,
        )
    )
