"""Shared leader diagnostics and retention overrides for independent API replicas."""

from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field

from surrealdb_client import get_db


class IngestionStats(BaseModel):
    queue_size: int = Field(ge=0)
    buffer_size: int = Field(ge=0)
    dropped_events: int = Field(ge=0)
    events_ingested_total: int = Field(ge=0)
    flushes_total: int = Field(ge=0)

    @classmethod
    def from_ingester(cls, ingester) -> IngestionStats:
        return cls(
            queue_size=ingester.queue.qsize(),
            buffer_size=len(ingester._buffer),
            dropped_events=ingester._dropped_count,
            events_ingested_total=ingester._stats_events_total,
            flushes_total=ingester._stats_flushes_total,
        )


def first_row(result: Any) -> dict | None:
    if not isinstance(result, list) or not result:
        return None
    row = result[0]
    if isinstance(row, list):
        row = row[0] if row else None
    return row if isinstance(row, dict) else None


async def publish_ingestion_stats(ingester):
    stats = IngestionStats.from_ingester(ingester).model_dump()
    stats["updated_at"] = datetime.now(UTC)
    await get_db().query("UPSERT runtime_state:ingestion CONTENT $stats", {"stats": stats})


async def read_ingestion_stats() -> IngestionStats | None:
    result = await get_db().query("SELECT * FROM runtime_state:ingestion WHERE updated_at > time::now() - 15s")
    row = first_row(result)
    return IngestionStats.model_validate(row) if row else None


async def apply_retention(cleanup_job):
    row = first_row(await get_db().query("SELECT * FROM runtime_state:retention"))
    if row:
        from server_info.models import RetentionSettings

        settings = RetentionSettings.model_validate(row)
        cleanup_job.interval_seconds = settings.cleanup_interval_seconds
        cleanup_job.task_max_count = settings.task_max_count
        cleanup_job.task_retention_hours = settings.task_retention_hours
        cleanup_job.dead_worker_retention_hours = settings.dead_worker_retention_hours


async def save_retention(settings):
    await get_db().query("UPSERT runtime_state:retention CONTENT $settings", {"settings": settings.model_dump()})
