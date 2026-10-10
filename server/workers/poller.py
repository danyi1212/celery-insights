import asyncio
import json
import logging
from datetime import UTC, date, datetime

from celery import Celery

from surrealdb_client import get_db

logger = logging.getLogger(__name__)

MISSED_POLLS_THRESHOLD = 3
# Half the reader-side expiry (EXECUTION_OBSERVATION_MAX_AGE_MS in src/utils/task-execution.ts): an unchanged
# observation is rewritten only this often, so steady-state polls stop firing a live-query event per task.
OBSERVATION_REFRESH_SECONDS = 60
DEFAULT_POLL_INTERVAL = 5


def _without_active_inspection(worker: dict) -> dict:
    data = worker.get("inspect_data")
    if not isinstance(data, dict):
        try:
            data = json.loads(worker.get("inspect") or "{}")
        except TypeError, ValueError:
            data = {}
    data = {key: value for key, value in data.items() if key != "active"}
    observed = data.get("_observed_at")
    if isinstance(observed, dict):
        data["_observed_at"] = {key: value for key, value in observed.items() if key != "active"}
    return data


_CLEAR_EXECUTION = (
    "UPDATE task SET execution_active = NONE "
    "WHERE worker = $hostname AND state = 'STARTED' AND execution_active != NONE"
)


def _json_default(value: object) -> str:
    # Match the snapshot's other timestamps (isoformat); fall back to str() like the diagnostics exporters.
    return value.isoformat() if isinstance(value, date) else str(value)


def _inspect_sync(celery_app: Celery) -> dict[str, dict]:
    """Run all inspect calls synchronously (blocking, runs in thread).

    Returns a dict keyed by hostname with combined inspect data for each worker.
    """
    inspect = celery_app.control.inspect(timeout=10)

    calls = {
        "stats": inspect.stats,
        "registered": inspect.registered,
        "scheduled": inspect.scheduled,
        "reserved": inspect.reserved,
        "active_queues": inspect.active_queues,
        "active": inspect.active,
    }

    results: dict[str, dict] = {}
    for key, fn in calls.items():
        # A task may start while replies are collected; absence only proves anything before the request.
        observed_at = datetime.now(UTC).isoformat()
        try:
            response = fn() or {}
        except Exception:
            logger.exception("Inspect %s call failed", key)
            response = {}
        for hostname, data in response.items():
            results.setdefault(hostname, {})[key] = data
            results[hostname].setdefault("_observed_at", {})[key] = observed_at

    return results


class WorkerPoller:
    """Periodically polls Celery inspect API and upserts worker data into SurrealDB.

    Tracks online/offline status using a missed_polls counter. Workers are only marked
    offline after MISSED_POLLS_THRESHOLD consecutive missed polls to avoid false positives
    from transient network issues or busy workers.
    """

    def __init__(self, celery_app: Celery, poll_interval: int = DEFAULT_POLL_INTERVAL):
        self.celery_app = celery_app
        self.poll_interval = poll_interval
        self._stop_event = asyncio.Event()
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        self._task = asyncio.create_task(self._poll_loop())
        logger.info(
            "Worker poller started (interval=%ds, offline_threshold=%d)",
            self.poll_interval,
            MISSED_POLLS_THRESHOLD,
        )

    async def stop(self) -> None:
        logger.info("Stopping worker poller...")
        self._stop_event.set()
        if self._task and not self._task.done():
            self._task.cancel()
            await asyncio.gather(self._task, return_exceptions=True)

    async def _poll_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                await self._poll()
            except Exception:
                logger.exception("Worker poll cycle failed")

            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self.poll_interval)
                break
            except TimeoutError:
                pass

    async def _poll(self) -> None:
        try:
            inspect_data = await asyncio.to_thread(_inspect_sync, self.celery_app)
        except Exception:
            logger.exception("Failed to run inspect calls")
            return

        now = datetime.now(UTC).isoformat()
        db = get_db()

        responding_hostnames = set(inspect_data.keys())

        # Upsert responding workers
        for hostname, data in inspect_data.items():
            try:
                serialized_data = json.dumps(data, default=_json_default)
                params: dict = {
                    "id": hostname,
                    "ts": now,
                    "data": serialized_data,
                    "inspect_data": json.loads(serialized_data),
                }
                query = (
                    "UPSERT type::record('worker', $id) SET "
                    "status = 'online', "
                    "last_updated = <datetime>$ts, "
                    "missed_polls = 0, "
                    "inspect = $data, "
                    "inspect_data = $inspect_data"
                )
                await db.query(query, params)
                active = data.get("active")
                observed_at = data.get("_observed_at", {}).get("active")
                if isinstance(active, list) and observed_at:
                    await db.query(
                        "UPDATE task SET execution_active = record::id(id) IN $active_ids, "
                        "execution_observed_at = <datetime>$observed_at, "
                        # The last positive time bounds a frozen runtime; clears and negative inspections keep it.
                        "execution_active_at = IF record::id(id) IN $active_ids THEN <datetime>$observed_at "
                        "ELSE execution_active_at END "
                        "WHERE worker = $hostname AND state = 'STARTED' "
                        "AND last_updated <= <datetime>$observed_at "
                        "AND (execution_active != (record::id(id) IN $active_ids) OR execution_observed_at = NONE "
                        "OR execution_observed_at < last_updated "
                        "OR execution_observed_at < <datetime>$observed_at - <duration>$refresh)",
                        {
                            "hostname": hostname,
                            "active_ids": [task["id"] for task in active if isinstance(task, dict) and task.get("id")],
                            "observed_at": observed_at,
                            "refresh": f"{OBSERVATION_REFRESH_SECONDS}s",
                        },
                    )
                else:
                    await db.query(_CLEAR_EXECUTION, {"hostname": hostname})
            except Exception:
                logger.exception("Failed to upsert worker %s", hostname)

        # Handle offline detection for known workers
        try:
            existing: list = await db.query(  # ty: ignore[invalid-assignment]
                "SELECT id, missed_polls, inspect, inspect_data FROM worker WHERE status = 'online'"
            )
            known_workers: list[dict] = existing[0] if existing and isinstance(existing[0], list) else existing
        except Exception:
            logger.exception("Failed to query existing workers for offline detection")
            return

        for worker in known_workers:
            worker_id = worker.get("id")
            if not worker_id:
                continue

            # Extract hostname from record ID (e.g., "worker:hostname" -> "hostname")
            # SurrealDB may wrap IDs with special chars in angle brackets (e.g., "worker:⟨host@name⟩")
            hostname = str(worker_id).removeprefix("worker:").strip("⟨⟩")
            if hostname in responding_hostnames:
                continue

            missed = (worker.get("missed_polls") or 0) + 1
            # A missing reply is no observation: tasks and the stored active list are cleared at once;
            # only the worker's status keeps the missed-poll grace.
            inspection = _without_active_inspection(worker)
            params = {
                "id": hostname,
                "missed": missed,
                "ts": now,
                "data": json.dumps(inspection),
                "inspect_data": inspection,
            }
            try:
                await db.query(_CLEAR_EXECUTION, {"hostname": hostname})
                if missed >= MISSED_POLLS_THRESHOLD:
                    await db.query(
                        "UPDATE type::record('worker', $id) SET status = 'offline', missed_polls = $missed, "
                        "last_updated = <datetime>$ts, inspect = $data, inspect_data = $inspect_data",
                        params,
                    )
                    logger.info("Worker %s marked offline after %d missed polls", hostname, missed)
                else:
                    await db.query(
                        "UPDATE type::record('worker', $id) SET missed_polls = $missed, "
                        "inspect = $data, inspect_data = $inspect_data",
                        params,
                    )
            except Exception:
                logger.exception("Failed to update missed polls for worker %s", hostname)
