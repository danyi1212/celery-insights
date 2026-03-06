import asyncio
import logging

from surrealdb_client import get_db

logger = logging.getLogger(__name__)


class CleanupJob:
    """Periodic cleanup job that enforces data retention policies in SurrealDB.

    SurrealDB has no native TTL or retention policies, so this job runs periodically
    to prune old tasks (with cascading event deletion), and dead workers.

    All policies are optional — setting values to None disables that policy.
    """

    def __init__(
        self,
        interval_seconds: int = 60,
        task_max_count: int | None = 10_000,
        task_retention_hours: float | None = None,
        dead_worker_retention_hours: float | None = 24,
    ):
        self.interval_seconds = interval_seconds
        self.task_max_count = task_max_count
        self.task_retention_hours = task_retention_hours
        self.dead_worker_retention_hours = dead_worker_retention_hours
        self._stop_event = asyncio.Event()
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        self._task = asyncio.create_task(self._cleanup_loop())
        policies = []
        if self.task_max_count is not None:
            policies.append(f"task_max_count={self.task_max_count}")
        if self.task_retention_hours is not None:
            policies.append(f"task_retention_hours={self.task_retention_hours}")
        if self.dead_worker_retention_hours is not None:
            policies.append(f"dead_worker_retention_hours={self.dead_worker_retention_hours}")
        policy_str = ", ".join(policies) if policies else "none (cleanup disabled)"
        logger.info("Cleanup job started (interval=%ds, policies: %s)", self.interval_seconds, policy_str)

    def stop(self) -> None:
        logger.info("Stopping cleanup job...")
        self._stop_event.set()
        if self._task and not self._task.done():
            self._task.cancel()

    async def _cleanup_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                await self._run_cleanup()
            except Exception:
                logger.exception("Cleanup cycle failed")

            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self.interval_seconds)
                break
            except TimeoutError:
                pass

    async def _run_cleanup(self) -> None:
        await self._cleanup_tasks_by_count()
        await self._cleanup_tasks_by_age()
        await self._cleanup_dead_workers()

    async def _cleanup_tasks_by_count(self) -> None:
        if self.task_max_count is None:
            return

        db = get_db()
        try:
            count_query = "SELECT count() AS total FROM task GROUP ALL"
            result: list = await db.query(count_query)  # ty: ignore[invalid-assignment]
            rows: list[dict] = result[0] if result and isinstance(result[0], list) else []
            total = rows[0].get("total", 0) if rows else 0
        except Exception:
            logger.exception("Failed to count tasks for cleanup")
            return

        excess = total - self.task_max_count
        if excess <= 0:
            return

        try:
            # Find the oldest tasks that exceed the limit
            oldest_result: list = await db.query(  # ty: ignore[invalid-assignment]
                "SELECT id FROM task ORDER BY last_updated ASC LIMIT $limit",
                {"limit": excess},
            )
            oldest_tasks: list[dict] = oldest_result[0] if oldest_result and isinstance(oldest_result[0], list) else []
        except Exception:
            logger.exception("Failed to find oldest tasks for count-based cleanup")
            return

        if not oldest_tasks:
            return

        task_ids = [t["id"] for t in oldest_tasks]
        await self._delete_tasks_and_events(task_ids)
        logger.info(
            "Count-based cleanup: deleted %d tasks (total was %d, max is %d)",
            len(task_ids),
            total,
            self.task_max_count,
        )

    async def _cleanup_tasks_by_age(self) -> None:
        if self.task_retention_hours is None:
            return

        db = get_db()
        try:
            result: list = await db.query(  # ty: ignore[invalid-assignment]
                "SELECT id FROM task WHERE last_updated < time::now() - $hours * 1h",
                {"hours": self.task_retention_hours},
            )
            old_tasks: list[dict] = result[0] if result and isinstance(result[0], list) else []
        except Exception:
            logger.exception("Failed to find old tasks for age-based cleanup")
            return

        if not old_tasks:
            return

        task_ids = [t["id"] for t in old_tasks]
        await self._delete_tasks_and_events(task_ids)
        logger.info("Age-based cleanup: deleted %d tasks older than %s hours", len(task_ids), self.task_retention_hours)

    async def _delete_tasks_and_events(self, task_ids: list) -> None:
        """Delete tasks and their associated events in SurrealDB."""
        db = get_db()

        # Extract task ID strings for event lookup (e.g., "task:abc123" -> "abc123")
        # SurrealDB may wrap IDs with special chars in angle brackets (e.g., "task:⟨uuid⟩")
        task_id_strings = [str(tid).removeprefix("task:").strip("⟨⟩") for tid in task_ids]

        try:
            await db.query(
                "DELETE FROM event WHERE task_id IN $task_ids",
                {"task_ids": task_id_strings},
            )
        except Exception:
            logger.exception("Failed to delete events for %d tasks", len(task_ids))

        try:
            await db.query(
                "DELETE FROM task WHERE id IN $task_ids",
                {"task_ids": task_ids},
            )
        except Exception:
            logger.exception("Failed to delete %d tasks", len(task_ids))

    async def _cleanup_dead_workers(self) -> None:
        if self.dead_worker_retention_hours is None:
            return

        db = get_db()
        try:
            result: list = await db.query(  # ty: ignore[invalid-assignment]
                "DELETE FROM worker WHERE status = 'offline' "
                "AND last_updated < time::now() - $hours * 1h RETURN BEFORE",
                {"hours": self.dead_worker_retention_hours},
            )
            deleted: list[dict] = result[0] if result and isinstance(result[0], list) else []
            if deleted:
                logger.info(
                    "Dead worker cleanup: deleted %d offline workers older than %s hours",
                    len(deleted),
                    self.dead_worker_retention_hours,
                )
        except Exception:
            logger.exception("Failed to clean up dead workers")
