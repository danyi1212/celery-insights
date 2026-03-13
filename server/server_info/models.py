import logging
import os
import platform
import resource
import time
from typing import NamedTuple, Self
from urllib.parse import urlsplit

from pydantic import BaseModel, Field
from starlette.requests import Request

from settings import Settings
from surrealdb_client import get_db


class CPULoad(NamedTuple):
    avg_1min: float
    avg_5min: float
    avg_15min: float


logger = logging.getLogger(__name__)
start_time = time.time()


_ALLOWED_TABLES = frozenset({"task", "event", "worker"})


async def query_table_count(db, table: str) -> int:
    """Query SurrealDB for the count of records in a table.

    Handles both SDK response formats:
    - Direct dict: [{"count": N}]
    - Nested list: [[{"count": N}]]
    """
    if table not in _ALLOWED_TABLES:
        raise ValueError(f"Invalid table name: {table}")
    result = await db.query(f"SELECT count() AS count FROM {table} GROUP ALL")
    if result and isinstance(result, list) and len(result) > 0:
        first = result[0]
        if isinstance(first, dict):
            return first.get("count", 0)
        if isinstance(first, list) and len(first) > 0 and isinstance(first[0], dict):
            return first[0].get("count", 0)
    return 0


def _format_endpoint(url: str) -> str:
    parts = urlsplit(url)
    if not parts.scheme or not parts.hostname:
        return url

    endpoint = f"{parts.scheme}://{parts.hostname}"
    if parts.port is not None:
        endpoint += f":{parts.port}"
    if parts.path:
        endpoint += parts.path
    return endpoint


class SurrealDBInfo(BaseModel):
    endpoint: str = Field(description="Sanitized SurrealDB endpoint")
    namespace: str = Field(description="Configured SurrealDB namespace")
    database: str = Field(description="Configured SurrealDB database name")
    topology: str = Field(description="Whether SurrealDB is embedded or external")
    storage: str | None = Field(description="Embedded storage engine when known")
    durability: str = Field(description="Durability mode: memory, persistent, or external")

    @classmethod
    def from_settings(cls, settings: Settings) -> Self:
        topology = "external" if settings.surrealdb_external_url else "embedded"
        storage = None if topology == "external" else settings.surrealdb_storage
        durability = "external" if topology == "external" else "memory" if storage == "memory" else "persistent"
        return cls(
            endpoint=_format_endpoint(settings.surrealdb_url),
            namespace=settings.surrealdb_namespace,
            database=settings.surrealdb_database,
            topology=topology,
            storage=storage,
            durability=durability,
        )


class IngestionRuntimeInfo(BaseModel):
    batch_interval_ms: int = Field(description="Configured batch flush interval")
    queue_size: int = Field(description="Current queued event count")
    buffer_size: int = Field(description="Current ingester buffer size")
    dropped_events: int = Field(description="Total events dropped due to backpressure")
    events_ingested_total: int = Field(description="Total events written to SurrealDB")
    flushes_total: int = Field(description="Total batch flush operations")

    @classmethod
    def from_runtime(cls, settings: Settings, ingester: object | None) -> Self:
        queue_size = 0
        buffer_size = 0
        dropped_events = 0
        events_ingested_total = 0
        flushes_total = 0

        if ingester is not None:
            buffer = getattr(ingester, "_buffer", [])
            if isinstance(buffer, list):
                buffer_size = len(buffer)

            queue = getattr(ingester, "queue", None)
            if queue is not None and hasattr(queue, "qsize"):
                try:
                    queue_size = int(queue.qsize())
                except TypeError, ValueError:
                    logger.debug("Unable to read ingester queue size", exc_info=True)

            for attr_name in ("_dropped_count", "_stats_events_total", "_stats_flushes_total"):
                try:
                    value = int(getattr(ingester, attr_name, 0))
                except TypeError, ValueError:
                    logger.debug("Unable to read ingester stat %s", attr_name, exc_info=True)
                    value = 0

                if attr_name == "_dropped_count":
                    dropped_events = value
                elif attr_name == "_stats_events_total":
                    events_ingested_total = value
                else:
                    flushes_total = value

        return cls(
            batch_interval_ms=settings.ingestion_batch_interval_ms,
            queue_size=queue_size,
            buffer_size=buffer_size,
            dropped_events=dropped_events,
            events_ingested_total=events_ingested_total,
            flushes_total=flushes_total,
        )


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
    event_count: int = Field(description="Number of raw events stored")
    timezone: str = Field(description="Configured server timezone")
    surrealdb: SurrealDBInfo
    ingestion: IngestionRuntimeInfo

    @classmethod
    async def create(cls, request: Request) -> Self:
        task_count = 0
        worker_count = 0
        event_count = 0
        try:
            db = get_db()
            task_count = await query_table_count(db, "task")
            worker_count = await query_table_count(db, "worker")
            event_count = await query_table_count(db, "event")
        except Exception:
            logger.exception("Failed to query SurrealDB for record counts")

        settings = getattr(request.app.state, "settings", None)
        if not isinstance(settings, Settings):
            settings = Settings()

        ingester = getattr(request.app.state, "ingester", None)

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
            event_count=event_count,
            timezone=settings.timezone,
            surrealdb=SurrealDBInfo.from_settings(settings),
            ingestion=IngestionRuntimeInfo.from_runtime(settings, ingester),
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
