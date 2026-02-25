import asyncio
import logging
import reprlib

from celery import Celery
from celery.result import AsyncResult

from surrealdb_client import get_db

logger = logging.getLogger(__name__)

RESULT_SIZE_LIMIT = 100 * 1024  # 100KB


def _truncate_result(value: str) -> tuple[str, bool]:
    """Truncate a result string if it exceeds the size limit. Returns (value, was_truncated)."""
    if len(value) <= RESULT_SIZE_LIMIT:
        return value, False
    return value[:RESULT_SIZE_LIMIT], True


def _fetch_result_sync(task_id: str, celery_app: Celery) -> dict:
    """Fetch task result from the Celery result backend (blocking, runs in thread)."""
    result = AsyncResult(task_id, app=celery_app)

    data: dict = {}

    if result.result is not None:
        result_str = repr(result.result)
        truncated_result, was_truncated = _truncate_result(result_str)
        data["result"] = truncated_result
        data["result_truncated"] = was_truncated

    if result.traceback is not None:
        data["traceback"] = str(result.traceback)

    if isinstance(result.result, Exception):
        data["exception"] = repr(result.result)

    return data


class ResultFetcher:
    """Fetches task results from the Celery result backend and updates SurrealDB.

    When the ingester detects a terminal state event (SUCCESS, FAILURE, REVOKED, REJECTED, RETRY),
    it calls this fetcher to retrieve the result/exception/traceback from the Celery result backend
    and update the corresponding SurrealDB task record.
    """

    def __init__(self, celery_app: Celery):
        self.celery_app = celery_app

    async def fetch_and_store(self, task_ids: list[str]) -> None:
        """Fetch results for terminal tasks and update SurrealDB."""
        tasks = [self._process_task(task_id) for task_id in task_ids]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _process_task(self, task_id: str) -> None:
        try:
            data = await asyncio.to_thread(_fetch_result_sync, task_id, self.celery_app)
        except Exception:
            logger.exception("Failed to fetch result for task %s from result backend", task_id)
            return

        if not data:
            return

        try:
            db = get_db()
            params = {"task_id": task_id}
            set_clauses = []

            for key, value in data.items():
                params[key] = value
                set_clauses.append(f"{key} = ${key}")

            query = f"UPDATE type::thing('task', $task_id) SET {', '.join(set_clauses)}"
            await db.query(query, params)
            logger.debug("Updated result for task %s (%s)", task_id, reprlib.repr(data))
        except Exception:
            logger.exception("Failed to update SurrealDB with result for task %s", task_id)
