import asyncio
import logging
import reprlib
from datetime import UTC, datetime
from typing import Any, cast

from celery import Celery
from celery.result import AsyncResult
from celery.backends.redis import RedisBackend

from events.ingester import build_workflow_summary_recompute
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


def _iso_datetime(value: str | None) -> str:
    if value:
        return value
    return datetime.now(tz=UTC).isoformat()


def _query_errors(result: object) -> list[str]:
    if not isinstance(result, list):
        return []

    errors: list[str] = []
    for entry in result:
        if not isinstance(entry, dict):
            continue
        typed_entry = cast(dict[str, Any], entry) if all(isinstance(key, str) for key in entry) else None
        if typed_entry and typed_entry.get("status") == "ERR":
            errors.append(str(typed_entry.get("result") or typed_entry.get("detail") or typed_entry))
    return errors


def _build_task_meta_upsert(task_id: str, meta: dict) -> tuple[str, dict]:
    state = str(meta.get("status") or "PENDING")
    last_updated = _iso_datetime(meta.get("date_done"))
    params: dict = {
        "task_id": task_id,
        "state": state,
        "last_updated": last_updated,
        "workflow_id": task_id,
        "type": meta.get("name"),
        "args": repr(meta.get("args", [])),
        "kwargs": repr(meta.get("kwargs", {})),
        "worker": meta.get("worker"),
        "retries": int(meta.get("retries") or 0),
        "routing_key": meta.get("queue"),
    }

    set_clauses = [
        "state = $state",
        "type = $type",
        "args = $args",
        "kwargs = $kwargs",
        "worker = $worker",
        "retries = $retries",
        "routing_key = $routing_key",
        "workflow_id = $workflow_id",
        "last_updated = <datetime>$last_updated",
        "sent_at = sent_at ?? <datetime>$last_updated",
        "children = children ?? []",
    ]

    if state == "SUCCESS":
        set_clauses.append("succeeded_at = succeeded_at ?? <datetime>$last_updated")
    elif state == "FAILURE":
        set_clauses.append("failed_at = failed_at ?? <datetime>$last_updated")
    elif state == "RETRY":
        set_clauses.append("retried_at = retried_at ?? <datetime>$last_updated")

    result_value = meta.get("result")
    if result_value is not None:
        result_str = repr(result_value)
        truncated_result, was_truncated = _truncate_result(result_str)
        params["result"] = truncated_result
        params["result_truncated"] = was_truncated
        set_clauses.append("result = $result")
        set_clauses.append("result_truncated = $result_truncated")

    if meta.get("traceback") is not None:
        params["traceback"] = str(meta["traceback"])
        set_clauses.append("traceback = $traceback")

    if state == "FAILURE" and result_value is not None:
        params["exception"] = repr(result_value)
        set_clauses.append("exception = $exception")

    query = f"UPSERT type::record('task', $task_id) SET {', '.join(set_clauses)}"
    return query, params


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

            query = f"UPDATE type::record('task', $task_id) SET {', '.join(set_clauses)}"
            result = await db.query(query, params)
            errors = _query_errors(result)
            if errors:
                logger.error("SurrealDB rejected result update for task %s: %s", task_id, "; ".join(errors))
                return
            logger.debug("Updated result for task %s (%s)", task_id, reprlib.repr(data))
        except Exception:
            logger.exception("Failed to update SurrealDB with result for task %s", task_id)


class ResultBackendPoller:
    """Polls Redis result backend metadata to backfill tasks when task events are absent."""

    def __init__(self, celery_app: Celery, interval_seconds: int = 2):
        self.celery_app = celery_app
        self.interval_seconds = interval_seconds
        self._seen: dict[str, str] = {}
        self._stop_event = asyncio.Event()
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        self._task = asyncio.create_task(self._run())
        logger.info("Result backend poller started (interval=%ss)", self.interval_seconds)

    async def stop(self) -> None:
        self._stop_event.set()
        if self._task and not self._task.done():
            self._task.cancel()
            await asyncio.gather(self._task, return_exceptions=True)

    async def _run(self) -> None:
        while not self._stop_event.is_set():
            try:
                await self._poll_once()
            except Exception:
                logger.exception("Result backend poll cycle failed")

            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self.interval_seconds)
                break
            except TimeoutError:
                pass

    async def _poll_once(self) -> None:
        backend = self.celery_app.backend
        if not isinstance(backend, RedisBackend):
            return

        prefix = backend.task_keyprefix.decode()
        key_ids = await asyncio.to_thread(
            lambda: [key.decode() for key in backend.client.scan_iter(match=f"{prefix}*")]
        )

        for key in key_ids:
            task_id = key.removeprefix(prefix)
            meta = await asyncio.to_thread(backend.get_task_meta, task_id)
            stamp = str(meta.get("date_done") or meta.get("status") or "")
            if self._seen.get(task_id) == stamp:
                continue

            query, params = _build_task_meta_upsert(task_id, meta)
            summary_query, summary_params = build_workflow_summary_recompute(
                {"uuid": task_id, "timestamp": datetime.now(tz=UTC).timestamp()},
                0,
            )

            db = get_db()
            full_query = "BEGIN TRANSACTION;\n" + ";\n".join([query, summary_query]) + ";\nCOMMIT TRANSACTION;"
            result = await db.query(full_query, params | summary_params)
            errors = _query_errors(result)
            if errors:
                logger.error(
                    "SurrealDB rejected result-backend poll upsert for task %s: %s",
                    task_id,
                    "; ".join(errors),
                )
                continue
            self._seen[task_id] = stamp
