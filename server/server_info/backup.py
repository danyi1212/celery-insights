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
            tasks = task_result[0] if isinstance(task_result[0], list) else task_result

        event_result = await db.query("SELECT * FROM event")
        if event_result and isinstance(event_result, list):
            events = event_result[0] if isinstance(event_result[0], list) else event_result

        worker_result = await db.query("SELECT * FROM worker")
        if worker_result and isinstance(worker_result, list):
            workers = worker_result[0] if isinstance(worker_result[0], list) else worker_result
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

    Clears existing data and imports all records in a single transaction so a partial
    failure rolls back completely instead of leaving the database empty.
    """
    db = get_db()

    version = data.get("version", 0)
    if version != 1:
        raise ValueError(f"Unsupported backup version: {version}")

    tasks = data.get("tasks", [])
    events = data.get("events", [])
    workers = data.get("workers", [])

    # Build all queries and params for a single atomic transaction
    queries = ["DELETE FROM task", "DELETE FROM event", "DELETE FROM worker"]
    params: dict = {}
    counts = {"tasks": 0, "events": 0, "workers": 0}

    for table, records, key in [("task", tasks, "tasks"), ("event", events, "events"), ("worker", workers, "workers")]:
        if table not in _ALLOWED_TABLES:
            raise ValueError(f"Invalid table name: {table}")
        for i, record in enumerate(records):
            record_copy = {**record}
            record_id = record_copy.pop("id", None)
            if record_id is None:
                continue
            id_str = str(record_id)
            if ":" in id_str:
                id_str = id_str.split(":", 1)[1].strip("⟨⟩")
            p = f"{table}_{i}"
            params[f"{p}_id"] = id_str
            params[f"{p}_data"] = record_copy
            queries.append(f"CREATE type::record('{table}', ${p}_id) CONTENT ${p}_data")
            counts[key] += 1

    full_query = "BEGIN TRANSACTION;\n" + ";\n".join(queries) + ";\nCOMMIT TRANSACTION;"
    await db.query(full_query, params)

    logger.info("Database import complete: %s", counts)
    return counts


_ALLOWED_TABLES = frozenset({"task", "event", "worker"})
