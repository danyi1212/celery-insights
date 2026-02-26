import logging
import os
import platform
import resource
import time
from typing import NamedTuple, Self

from pydantic import BaseModel, Field
from starlette.requests import Request

from surrealdb_client import get_db


class CPULoad(NamedTuple):
    avg_1min: float
    avg_5min: float
    avg_15min: float


logger = logging.getLogger(__name__)
start_time = time.time()


async def _query_count(db, table: str) -> int:
    """Query SurrealDB for the count of records in a table."""
    result = await db.query(f"SELECT count() AS count FROM {table} GROUP ALL")
    if result and isinstance(result, list) and len(result) > 0:
        first = result[0]
        if isinstance(first, dict):
            return first.get("count", 0)
    return 0


class ServerInfo(BaseModel):
    cpu_usage: CPULoad = Field(description="CPU load average in last 1, 5 and 15 minutes")
    memory_usage: float = Field(description="Memory Usage in KB")
    uptime: float = Field(description="Server Uptime in seconds")
    server_hostname: str = Field(description="Server Hostname")
    server_port: int = Field(description="Server Port")
    server_version: str = Field(description="Server Version")
    server_os: str = Field(description="Server OS")
    server_name: str = Field(description="Server Device Name")
    python_version: str = Field(description="Python Version")
    task_count: int = Field(description="Number of tasks stored")
    worker_count: int = Field(description="Number of workers known")

    @classmethod
    async def create(cls, request: Request) -> Self:
        task_count = 0
        worker_count = 0
        try:
            db = get_db()
            task_count = await _query_count(db, "task")
            worker_count = await _query_count(db, "worker")
        except Exception:
            logger.exception("Failed to query SurrealDB for task/worker counts")

        rusage = resource.getrusage(resource.RUSAGE_SELF)
        return cls(
            cpu_usage=CPULoad(*os.getloadavg()),
            memory_usage=rusage.ru_maxrss,
            uptime=time.time() - start_time,
            server_hostname=request.url.hostname or "",
            server_port=request.url.port or 0,
            server_version=request.app.version,
            server_os=platform.system(),
            server_name=platform.node(),
            python_version=platform.python_version(),
            task_count=task_count,
            worker_count=worker_count,
        )


class RetentionSettings(BaseModel):
    cleanup_interval_seconds: int = Field(description="How often the cleanup job runs (seconds)")
    task_max_count: int | None = Field(description="Max tasks to keep (None = unlimited)")
    task_retention_hours: float | None = Field(description="Delete tasks older than this (None = no limit)")
    dead_worker_retention_hours: float | None = Field(description="Delete offline workers older than this")


class RecordCounts(BaseModel):
    tasks: int = Field(description="Number of task records")
    events: int = Field(description="Number of event records")
    workers: int = Field(description="Number of worker records")


class RetentionInfo(BaseModel):
    settings: RetentionSettings
    counts: RecordCounts


class ClientDebugInfo(BaseModel):
    settings: dict
    screen_width: int
    screen_height: int


class StateDump(BaseModel):
    tasks: list[dict]
    workers: list[dict]
