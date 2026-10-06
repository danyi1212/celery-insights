import asyncio
import logging
import reprlib
from datetime import UTC, datetime
from typing import Any, cast

from celery import Celery
from celery.result import AsyncResult
from celery.backends.redis import RedisBackend
from surrealdb.types import Value

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
    last_updated = meta.get("date_done")
    observed_at = datetime.now(tz=UTC).isoformat()
    params: dict = {
        "task_id": task_id,
        "state": state,
        "last_updated": last_updated,
        "observed_at": observed_at,
        "workflow_id": task_id,
        "type": meta.get("name"),
        "args": repr(meta["args"]) if "args" in meta else None,
        "kwargs": repr(meta["kwargs"]) if "kwargs" in meta else None,
        "worker": meta.get("worker"),
        "retries": int(meta["retries"] or 0) if "retries" in meta else None,
        "routing_key": meta.get("queue"),
    }

    set_clauses = [
        "state = IF $meta_apply_state THEN $state ELSE $meta_previous.state END",
        "type = IF $meta_apply_state THEN $type ?? $meta_previous.type ELSE $meta_previous.type END",
        "args = IF $meta_apply_state THEN $args ?? $meta_previous.args ELSE $meta_previous.args END",
        "kwargs = IF $meta_apply_state THEN $kwargs ?? $meta_previous.kwargs ELSE $meta_previous.kwargs END",
        "worker = IF $meta_apply_state THEN $worker ?? $meta_previous.worker ELSE $meta_previous.worker END",
        "retries = IF $meta_apply_state THEN $retries ?? $meta_previous.retries ELSE $meta_previous.retries END",
        "routing_key = IF $meta_apply_state THEN $routing_key ?? $meta_previous.routing_key "
        "ELSE $meta_previous.routing_key END",
        "workflow_id = $meta_previous.workflow_id ?? $workflow_id",
        "last_updated = IF $meta_apply_state THEN $meta_timestamp ELSE $meta_previous.last_updated END",
        "first_observed_at = $meta_previous.first_observed_at ?? $meta_timestamp",
        "sent_at = $meta_previous.sent_at ?? $meta_timestamp",
        "children = $meta_previous.children ?? []",
    ]

    if state == "SUCCESS" and last_updated:
        set_clauses.append(
            "succeeded_at = IF $meta_apply_state THEN $meta_previous.succeeded_at ?? $meta_timestamp "
            "ELSE $meta_previous.succeeded_at END"
        )
    elif state == "FAILURE" and last_updated:
        set_clauses.append(
            "failed_at = IF $meta_apply_state THEN $meta_previous.failed_at ?? $meta_timestamp "
            "ELSE $meta_previous.failed_at END"
        )
    elif state == "RETRY" and last_updated:
        set_clauses.append(
            "retried_at = IF $meta_apply_state THEN $meta_previous.retried_at ?? $meta_timestamp "
            "ELSE $meta_previous.retried_at END"
        )

    result_value = meta.get("result")
    if result_value is not None:
        result_str = repr(result_value)
        truncated_result, was_truncated = _truncate_result(result_str)
        params["result"] = truncated_result
        params["result_truncated"] = was_truncated
        set_clauses.append("result = IF $meta_apply_state THEN $result ELSE $meta_previous.result END")
        set_clauses.append(
            "result_truncated = IF $meta_apply_state THEN $result_truncated ELSE $meta_previous.result_truncated END"
        )

    if meta.get("traceback") is not None:
        params["traceback"] = str(meta["traceback"])
        set_clauses.append("traceback = IF $meta_apply_state THEN $traceback ELSE $meta_previous.traceback END")

    if state == "FAILURE" and result_value is not None:
        params["exception"] = repr(result_value)
        set_clauses.append("exception = IF $meta_apply_state THEN $exception ELSE $meta_previous.exception END")

    if state == "FAILURE" or meta.get("traceback"):
        set_clauses.append("had_error = true")

    target = "type::record('task', $task_id)"
    assignments = ", ".join(set_clauses)
    query = (
        f"LET $meta_previous = (SELECT * FROM {target})[0] ?? {{}}; "
        "LET $meta_timestamp = IF $last_updated != NONE THEN <datetime>$last_updated "
        "ELSE $meta_previous.last_updated ?? <datetime>$observed_at END; "
        "LET $meta_apply_state = $meta_previous.state = NONE OR "
        "IF $last_updated != NONE THEN $meta_previous.last_updated = NONE "
        "OR $meta_timestamp >= $meta_previous.last_updated "
        "ELSE $meta_previous.state NOT IN ['SUCCESS', 'FAILURE', 'REVOKED', 'REJECTED', 'IGNORED'] END; "
        f"UPSERT {target} SET {assignments}"
    )
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
            params: dict[str, Value] = {"task_id": task_id}
            set_clauses = []

            for key, value in data.items():
                params[key] = value
                set_clauses.append(f"{key} = ${key}")

            if data.get("exception") or data.get("traceback"):
                set_clauses.append("had_error = true")

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
