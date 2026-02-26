import json
import logging
from io import BytesIO
from typing import Any

from surrealdb_client import get_db

logger = logging.getLogger(__name__)


async def export_database() -> BytesIO:
    """Export all tasks, events, and workers from SurrealDB as a JSON file."""
    db = get_db()
    tasks: list[Any] = []
    events: list[Any] = []
    workers: list[Any] = []

    try:
        task_result = await db.query("SELECT * FROM task")
        if task_result and isinstance(task_result, list):
            tasks = task_result

        event_result = await db.query("SELECT * FROM event")
        if event_result and isinstance(event_result, list):
            events = event_result

        worker_result = await db.query("SELECT * FROM worker")
        if worker_result and isinstance(worker_result, list):
            workers = worker_result
    except Exception:
        logger.exception("Failed to query SurrealDB for database export")
        raise

    export_data = {
        "version": 1,
        "tasks": tasks,
        "events": events,
        "workers": workers,
    }

    buffer = BytesIO()
    buffer.write(json.dumps(export_data, default=str, indent=2).encode("utf-8"))
    buffer.seek(0)
    return buffer


async def import_database(data: dict) -> dict[str, int]:
    """Import tasks, events, and workers into SurrealDB from an export file.

    Clears existing data before importing. Returns counts of imported records.
    """
    db = get_db()

    version = data.get("version", 0)
    if version != 1:
        raise ValueError(f"Unsupported backup version: {version}")

    tasks = data.get("tasks", [])
    events = data.get("events", [])
    workers = data.get("workers", [])

    # Clear existing data
    await db.query("DELETE FROM task; DELETE FROM event; DELETE FROM worker;")

    imported = {"tasks": 0, "events": 0, "workers": 0}

    # Import tasks
    for task in tasks:
        try:
            task_id = task.pop("id", None)
            if task_id is None:
                continue
            # Extract plain ID from SurrealDB RecordId format
            id_str = str(task_id)
            if ":" in id_str:
                id_str = id_str.split(":", 1)[1]
            await db.query("CREATE task:$id CONTENT $data", {"id": id_str, "data": task})
            imported["tasks"] += 1
        except (OSError, RuntimeError, ValueError, KeyError):
            logger.warning("Failed to import task %s", task_id, exc_info=True)

    # Import events
    for event in events:
        try:
            event_id = event.pop("id", None)
            if event_id is None:
                continue
            id_str = str(event_id)
            if ":" in id_str:
                id_str = id_str.split(":", 1)[1]
            await db.query("CREATE event:$id CONTENT $data", {"id": id_str, "data": event})
            imported["events"] += 1
        except (OSError, RuntimeError, ValueError, KeyError):
            logger.warning("Failed to import event %s", event_id, exc_info=True)

    # Import workers
    for worker in workers:
        try:
            worker_id = worker.pop("id", None)
            if worker_id is None:
                continue
            id_str = str(worker_id)
            if ":" in id_str:
                id_str = id_str.split(":", 1)[1]
            await db.query("CREATE worker:$id CONTENT $data", {"id": id_str, "data": worker})
            imported["workers"] += 1
        except (OSError, RuntimeError, ValueError, KeyError):
            logger.warning("Failed to import worker %s", worker_id, exc_info=True)

    logger.info("Database import complete: %s", imported)
    return imported
