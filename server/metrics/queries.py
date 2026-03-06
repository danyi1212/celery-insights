import logging

from server_info.models import query_table_count
from surrealdb_client import get_db

logger = logging.getLogger(__name__)


def _extract_rows(result: object) -> list[dict]:
    """Extract rows from a SurrealDB query result, handling both response formats."""
    if not isinstance(result, list) or len(result) == 0:
        return []
    first = result[0]
    if isinstance(first, dict):
        return result  # type: ignore[return-value]
    if isinstance(first, list):
        return first  # type: ignore[return-value]
    return []


async def query_task_counts_by_state() -> list[dict]:
    try:
        db = get_db()
        result = await db.query("SELECT state, count() AS count FROM task GROUP BY state")
        return _extract_rows(result)
    except Exception:
        logger.exception("Failed to query task counts by state")
        return []


async def query_worker_counts() -> list[dict]:
    try:
        db = get_db()
        result = await db.query("SELECT status, count() AS count FROM worker GROUP BY status")
        return _extract_rows(result)
    except Exception:
        logger.exception("Failed to query worker counts")
        return []


async def query_task_runtime_values() -> list[float]:
    try:
        db = get_db()
        result = await db.query("SELECT runtime FROM task WHERE runtime IS NOT NONE")
        rows = _extract_rows(result)
        return [r["runtime"] for r in rows if isinstance(r.get("runtime"), int | float)]
    except Exception:
        logger.exception("Failed to query task runtimes")
        return []


async def query_tasks_by_type() -> list[dict]:
    try:
        db = get_db()
        result = await db.query("SELECT type, count() AS count FROM task WHERE type IS NOT NONE GROUP BY type")
        return _extract_rows(result)
    except Exception:
        logger.exception("Failed to query tasks by type")
        return []


async def query_tasks_by_worker() -> list[dict]:
    try:
        db = get_db()
        result = await db.query("SELECT worker, count() AS count FROM task WHERE worker IS NOT NONE GROUP BY worker")
        return _extract_rows(result)
    except Exception:
        logger.exception("Failed to query tasks by worker")
        return []


async def query_runtime_by_type() -> list[dict]:
    try:
        db = get_db()
        result = await db.query("SELECT type, runtime FROM task WHERE runtime IS NOT NONE AND type IS NOT NONE")
        return _extract_rows(result)
    except Exception:
        logger.exception("Failed to query runtime by type")
        return []


async def query_exceptions_by_type() -> list[dict]:
    try:
        db = get_db()
        result = await db.query(
            "SELECT exception, count() AS count FROM task WHERE exception IS NOT NONE GROUP BY exception"
        )
        return _extract_rows(result)
    except Exception:
        logger.exception("Failed to query exceptions by type")
        return []


async def query_worker_active_tasks() -> list[dict]:
    try:
        db = get_db()
        result = await db.query(
            "SELECT worker, count() AS count FROM task WHERE state = 'STARTED' AND worker IS NOT NONE GROUP BY worker"
        )
        return _extract_rows(result)
    except Exception:
        logger.exception("Failed to query worker active tasks")
        return []


async def query_worker_processed_tasks() -> list[dict]:
    try:
        db = get_db()
        result = await db.query(
            "SELECT worker, count() AS count FROM task"
            " WHERE state IN ['SUCCESS', 'FAILURE', 'REVOKED', 'REJECTED']"
            " AND worker IS NOT NONE GROUP BY worker"
        )
        return _extract_rows(result)
    except Exception:
        logger.exception("Failed to query worker processed tasks")
        return []


async def query_table_counts() -> dict[str, int]:
    try:
        db = get_db()
        tasks = await query_table_count(db, "task")
        workers = await query_table_count(db, "worker")
        events = await query_table_count(db, "event")
        return {"tasks": tasks, "workers": workers, "events": events}
    except Exception:
        logger.exception("Failed to query table counts")
        return {"tasks": 0, "workers": 0, "events": 0}
