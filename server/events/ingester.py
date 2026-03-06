import asyncio
import json
import logging
import re
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

from surrealdb_client import get_db

logger = logging.getLogger(__name__)

TERMINAL_EVENT_TYPES = frozenset({"task-succeeded", "task-failed", "task-revoked", "task-rejected"})

EVENT_STATE_MAP: dict[str, str] = {
    "task-sent": "PENDING",
    "task-received": "RECEIVED",
    "task-started": "STARTED",
    "task-succeeded": "SUCCESS",
    "task-failed": "FAILURE",
    "task-rejected": "REJECTED",
    "task-revoked": "REVOKED",
    "task-retried": "RETRY",
}

EVENT_TS_FIELD_MAP: dict[str, str] = {
    "task-sent": "sent_at",
    "task-received": "received_at",
    "task-started": "started_at",
    "task-succeeded": "succeeded_at",
    "task-failed": "failed_at",
    "task-rejected": "rejected_at",
    "task-revoked": "revoked_at",
    "task-retried": "retried_at",
}

# Celery event field -> SurrealDB task record field
TASK_FIELD_MAP: dict[str, str] = {
    "name": "type",
    "args": "args",
    "kwargs": "kwargs",
    "eta": "eta",
    "expires": "expires",
    "retries": "retries",
    "exchange": "exchange",
    "routing_key": "routing_key",
    "root_id": "root_id",
    "parent_id": "parent_id",
    "result": "result",
    "exception": "exception",
    "traceback": "traceback",
    "runtime": "runtime",
}

BACKPRESSURE_THRESHOLD = 10_000
BUFFER_SIZE_THRESHOLD = 500

_WORKER_SKIP_FIELDS = frozenset({"type", "hostname", "timestamp", "local_received", "clock"})
_SAFE_IDENT = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


def _epoch_to_iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=UTC).isoformat()


class SurrealDBIngester:
    """Consumes Celery events from a queue and writes them to SurrealDB in batches.

    Replaces EventBroadcaster: instead of broadcasting via WebSocket, events are
    accumulated in a buffer and flushed to SurrealDB periodically or when terminal
    events arrive.
    """

    def __init__(
        self,
        queue: asyncio.Queue[dict],
        batch_interval_ms: int = 100,
        on_terminal: Callable[[list[str]], Awaitable[None]] | None = None,
    ):
        self.queue = queue
        self.batch_interval_ms = batch_interval_ms
        self.on_terminal = on_terminal
        self._buffer: list[dict] = []
        self._has_terminal = False
        self._stop_event = asyncio.Event()
        self._consume_task: asyncio.Task | None = None
        self._flush_task: asyncio.Task | None = None
        self._stats_task: asyncio.Task | None = None
        self._dropped_count = 0
        self._stats_events_total = 0
        self._stats_flushes_total = 0

    def start(self) -> None:
        self._consume_task = asyncio.create_task(self._consume_loop())
        self._flush_task = asyncio.create_task(self._flush_loop())
        self._stats_task = asyncio.create_task(self._stats_loop())
        logger.info(
            "SurrealDB ingester started (batch_interval=%dms, buffer_threshold=%d, backpressure=%d)",
            self.batch_interval_ms,
            BUFFER_SIZE_THRESHOLD,
            BACKPRESSURE_THRESHOLD,
        )

    async def _consume_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                event = await asyncio.wait_for(self.queue.get(), timeout=0.5)
            except TimeoutError:
                continue
            except asyncio.CancelledError:
                break

            if len(self._buffer) >= BACKPRESSURE_THRESHOLD:
                self._dropped_count += 1
                if self._dropped_count % 100 == 1:
                    logger.warning(
                        "Backpressure: buffer at %d, dropped %d total (threshold: %d)",
                        len(self._buffer),
                        self._dropped_count,
                        BACKPRESSURE_THRESHOLD,
                    )
                continue

            self._buffer.append(event)

            event_type = event.get("type", "")
            if event_type in TERMINAL_EVENT_TYPES:
                self._has_terminal = True

            if len(self._buffer) >= BUFFER_SIZE_THRESHOLD or self._has_terminal:
                await self._flush()

    async def _flush_loop(self) -> None:
        interval = self.batch_interval_ms / 1000.0
        while not self._stop_event.is_set():
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=interval)
                break
            except TimeoutError:
                pass
            if self._buffer:
                await self._flush()

    async def _flush(self) -> None:
        if not self._buffer:
            return

        events = self._buffer
        self._buffer = []
        self._has_terminal = False

        terminal_task_ids: list[str] = []
        queries: list[str] = []
        params: dict = {}

        for i, event in enumerate(events):
            event_type = event.get("type", "")
            category = event_type.split("-", 1)[0] if "-" in event_type else ""

            if category == "task":
                q, p = build_task_upsert(event, i)
                if q:
                    queries.append(q)
                    params.update(p)

                cq, cp = build_children_update(event, i)
                if cq:
                    queries.append(cq)
                    params.update(cp)

                if event_type in TERMINAL_EVENT_TYPES:
                    task_id = event.get("uuid")
                    if task_id:
                        terminal_task_ids.append(task_id)

            elif category == "worker":
                q, p = build_worker_upsert(event, i)
                if q:
                    queries.append(q)
                    params.update(p)

            rq, rp = build_raw_event(event, i)
            if rq:
                queries.append(rq)
                params.update(rp)

        if queries:
            try:
                db = get_db()
                full_query = "BEGIN TRANSACTION;\n" + ";\n".join(queries) + ";\nCOMMIT TRANSACTION;"
                await db.query(full_query, params)
                self._stats_events_total += len(events)
                self._stats_flushes_total += 1
                logger.debug("Flushed %d events (%d queries) to SurrealDB", len(events), len(queries))
            except Exception:
                logger.exception("Failed to flush %d events to SurrealDB", len(events))
                self._buffer = events + self._buffer
                return

        if terminal_task_ids and self.on_terminal:
            try:
                await self.on_terminal(terminal_task_ids)
            except Exception:
                logger.exception("Terminal event callback failed for %d tasks", len(terminal_task_ids))

    async def _stats_loop(self) -> None:
        prev_events = 0
        while not self._stop_event.is_set():
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=30.0)
                break
            except TimeoutError:
                pass
            events = self._stats_events_total
            delta = events - prev_events
            if delta > 0:
                rate = delta / 30.0
                logger.info(
                    "Ingestion stats: %d events in %d batches (%.1f/s), buffer=%d, queue=%d, dropped=%d",
                    events,
                    self._stats_flushes_total,
                    rate,
                    len(self._buffer),
                    self.queue.qsize(),
                    self._dropped_count,
                )
            prev_events = events

    async def stop(self) -> None:
        logger.info("Stopping SurrealDB ingester...")
        self._stop_event.set()
        tasks = [t for t in (self._consume_task, self._flush_task, self._stats_task) if t and not t.done()]
        if tasks:
            for t in tasks:
                t.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
        logger.info("SurrealDB ingester stopped")


def build_task_upsert(event: dict, idx: int) -> tuple[str, dict]:
    """Build a conditional UPSERT for a task event with out-of-order protection."""
    task_id = event.get("uuid")
    event_type = event.get("type", "")
    timestamp = event.get("timestamp")

    if not task_id or event_type not in EVENT_STATE_MAP or not timestamp:
        return "", {}

    state = EVENT_STATE_MAP[event_type]
    ts_field = EVENT_TS_FIELD_MAP[event_type]
    ts_iso = _epoch_to_iso(timestamp)

    p = f"t{idx}"
    params: dict = {
        f"{p}_id": task_id,
        f"{p}_state": state,
        f"{p}_ts": ts_iso,
    }

    set_clauses = [
        f"state = IF last_updated IS NONE OR <datetime>${p}_ts > last_updated THEN ${p}_state ELSE state END",
        f"last_updated = IF last_updated IS NONE OR <datetime>${p}_ts > last_updated"
        f" THEN <datetime>${p}_ts ELSE last_updated END",
        f"{ts_field} = IF {ts_field} IS NONE OR <datetime>${p}_ts < {ts_field}"
        f" THEN <datetime>${p}_ts ELSE {ts_field} END",
    ]

    for event_field, db_field in TASK_FIELD_MAP.items():
        value = event.get(event_field)
        if value is not None:
            pname = f"{p}_{db_field}"
            params[pname] = value if isinstance(value, int | float) else str(value)
            set_clauses.append(
                f"{db_field} = IF last_updated IS NONE OR <datetime>${p}_ts >= last_updated"
                f" THEN ${pname} ELSE {db_field} END"
            )

    hostname = event.get("hostname")
    if hostname:
        params[f"{p}_worker"] = hostname
        set_clauses.append(
            f"worker = IF last_updated IS NONE OR <datetime>${p}_ts >= last_updated THEN ${p}_worker ELSE worker END"
        )

    query = f"UPSERT type::record('task', ${p}_id) SET " + ", ".join(set_clauses)
    return query, params


def build_children_update(event: dict, idx: int) -> tuple[str, dict]:
    """Build an UPDATE to add a child task to its parent's children array."""
    parent_id = event.get("parent_id")
    child_id = event.get("uuid")
    event_type = event.get("type", "")

    if not parent_id or not child_id or event_type not in ("task-sent", "task-received"):
        return "", {}

    p = f"ch{idx}"
    params = {f"{p}_parent": parent_id, f"{p}_child": child_id}
    query = (
        f"UPSERT type::record('task', ${p}_parent) SET "
        f"children = array::union(children ?? [], [${p}_child]), "
        f"state = state ?? 'PENDING', "
        f"last_updated = last_updated ?? time::now()"
    )
    return query, params


def build_worker_upsert(event: dict, idx: int) -> tuple[str, dict]:
    """Build an UPSERT for a worker event."""
    hostname = event.get("hostname")
    timestamp = event.get("timestamp")

    if not hostname or not timestamp:
        return "", {}

    p = f"w{idx}"
    ts_iso = _epoch_to_iso(timestamp)
    status = "offline" if event.get("type") == "worker-offline" else "online"

    params: dict = {
        f"{p}_id": hostname,
        f"{p}_ts": ts_iso,
        f"{p}_status": status,
    }

    set_clauses = [
        f"status = IF last_updated IS NONE OR <datetime>${p}_ts >= last_updated THEN ${p}_status ELSE status END",
        f"last_updated = IF last_updated IS NONE OR <datetime>${p}_ts > last_updated"
        f" THEN <datetime>${p}_ts ELSE last_updated END",
        f"missed_polls = IF last_updated IS NONE OR <datetime>${p}_ts >= last_updated THEN 0 ELSE missed_polls END",
    ]

    for key, value in event.items():
        if key not in _WORKER_SKIP_FIELDS and value is not None and _SAFE_IDENT.match(key):
            pname = f"{p}_{key}"
            params[pname] = value
            set_clauses.append(
                f"`{key}` = IF last_updated IS NONE OR <datetime>${p}_ts >= last_updated THEN ${pname} ELSE `{key}` END"
            )

    query = f"UPSERT type::record('worker', ${p}_id) SET " + ", ".join(set_clauses)
    return query, params


def build_raw_event(event: dict, idx: int) -> tuple[str, dict]:
    """Build a CREATE for a raw event record."""
    event_type = event.get("type")
    timestamp = event.get("timestamp")

    if not event_type or not timestamp:
        return "", {}

    p = f"e{idx}"
    ts_iso = _epoch_to_iso(timestamp)

    params: dict = {
        f"{p}_type": event_type,
        f"{p}_ts": ts_iso,
        f"{p}_data": json.dumps(event),
    }

    set_clauses = [
        f"event_type = ${p}_type",
        f"timestamp = <datetime>${p}_ts",
        f"data = ${p}_data",
    ]

    task_id = event.get("uuid")
    if task_id:
        params[f"{p}_task_id"] = task_id
        set_clauses.append(f"task_id = ${p}_task_id")

    hostname = event.get("hostname")
    if hostname:
        params[f"{p}_hostname"] = hostname
        set_clauses.append(f"hostname = ${p}_hostname")

    query = "CREATE event SET " + ", ".join(set_clauses)
    return query, params
