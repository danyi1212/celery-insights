import asyncio
import json
import logging
from datetime import UTC, datetime

from celery import Celery

from surrealdb_client import get_db

logger = logging.getLogger(__name__)

MISSED_POLLS_THRESHOLD = 3
DEFAULT_POLL_INTERVAL = 5


def _inspect_sync(celery_app: Celery) -> dict[str, dict]:
    """Run all inspect calls synchronously (blocking, runs in thread).

    Returns a dict keyed by hostname with combined inspect data for each worker.
    """
    inspect = celery_app.control.inspect(timeout=10)

    calls = {
        "stats": inspect.stats,
        "active": inspect.active,
        "registered": inspect.registered,
        "scheduled": inspect.scheduled,
        "reserved": inspect.reserved,
        "active_queues": inspect.active_queues,
    }

    results: dict[str, dict] = {}
    for key, fn in calls.items():
        try:
            response = fn() or {}
        except Exception:
            logger.exception("Inspect %s call failed", key)
            response = {}
        for hostname, data in response.items():
            results.setdefault(hostname, {})[key] = data

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

    def stop(self) -> None:
        logger.info("Stopping worker poller...")
        self._stop_event.set()
        if self._task and not self._task.done():
            self._task.cancel()

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
                params: dict = {
                    "id": hostname,
                    "ts": now,
                    "data": json.dumps(data),
                }
                query = (
                    "UPSERT type::thing('worker', $id) SET "
                    "status = 'online', "
                    "last_updated = <datetime>$ts, "
                    "missed_polls = 0, "
                    "inspect = $data"
                )
                await db.query(query, params)
            except Exception:
                logger.exception("Failed to upsert worker %s", hostname)

        # Handle offline detection for known workers
        try:
            existing: list = await db.query(  # ty: ignore[invalid-assignment]
                "SELECT id, missed_polls FROM worker WHERE status = 'online'"
            )
            known_workers: list[dict] = existing[0] if existing and isinstance(existing[0], list) else []
        except Exception:
            logger.exception("Failed to query existing workers for offline detection")
            return

        for worker in known_workers:
            worker_id = worker.get("id")
            if not worker_id:
                continue

            # Extract hostname from record ID (e.g., "worker:hostname" -> "hostname")
            hostname = str(worker_id).removeprefix("worker:")
            if hostname in responding_hostnames:
                continue

            missed = (worker.get("missed_polls") or 0) + 1
            try:
                if missed >= MISSED_POLLS_THRESHOLD:
                    await db.query(
                        "UPDATE type::thing('worker', $id) SET "
                        "status = 'offline', missed_polls = $missed, last_updated = <datetime>$ts",
                        {"id": hostname, "missed": missed, "ts": now},
                    )
                    logger.info("Worker %s marked offline after %d missed polls", hostname, missed)
                else:
                    await db.query(
                        "UPDATE type::thing('worker', $id) SET missed_polls = $missed",
                        {"id": hostname, "missed": missed},
                    )
            except Exception:
                logger.exception("Failed to update missed polls for worker %s", hostname)
