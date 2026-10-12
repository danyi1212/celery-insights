import asyncio
import logging
import time
from threading import BoundedSemaphore, Event, Thread

from celery import Celery
from celery.events import EventReceiver
from events.ingester import validate_event

logger = logging.getLogger(__name__)


class ValidatedEventReceiver(EventReceiver):
    """Isolate producer errors before Celery localizes timestamps and clocks."""

    def _receive(self, body, message, *args, **kwargs):
        for event in body if isinstance(body, list) else [body]:
            try:
                validate_event(event)
                super()._receive(event, message, *args, **kwargs)
            except Exception:
                logger.warning("Discarding malformed broker event", exc_info=True)


class CeleryEventReceiver(Thread):
    """Thread for consuming events from a Celery cluster."""

    def __init__(self, app: Celery, loop: asyncio.AbstractEventLoop):
        super().__init__(daemon=True)
        self.app = app
        self._loop = loop
        self._stop_signal = Event()
        self.queue: asyncio.Queue[dict] = asyncio.Queue(maxsize=10_000)
        self._pending = BoundedSemaphore(10_000)
        self.receiver: EventReceiver | None = None

    def run(self) -> None:
        logger.info("Starting event consumer...")
        while not self._stop_signal.is_set():
            try:
                self.consume_events()
            except KeyboardInterrupt, SystemExit:
                break
            except Exception as e:
                logger.exception(f"Failed to capture events: '{e}', trying again in 10 seconds.")
                if not self._stop_signal.is_set():
                    time.sleep(10)

    def consume_events(self):
        logger.info("Connecting to celery cluster...")
        with self.app.connection() as connection:
            try:
                self.app.control.enable_events()
            except Exception:
                logger.warning("Failed to broadcast enable_events before consuming Celery events", exc_info=True)

            self.receiver = ValidatedEventReceiver(
                connection,
                app=self.app,
                handlers={
                    "*": self.on_event,
                },
            )
            logger.info("Starting to consume events...")
            self.receiver.capture(limit=None, timeout=None, wakeup=True)

    def on_event(self, event: dict) -> None:
        logger.debug(f"Received event: {event}")
        # asyncio.Queue is not thread-safe; use call_soon_threadsafe to schedule
        # the put from this receiver thread onto the asyncio event loop.
        if self._pending.acquire(blocking=False):
            try:
                self._loop.call_soon_threadsafe(self._enqueue, event)
            except RuntimeError:
                self._pending.release()
                raise
        if self._stop_signal.is_set():
            raise KeyboardInterrupt("Stop signal received")

    def _enqueue(self, event: dict) -> None:
        try:
            self.queue.put_nowait(event)
        except asyncio.QueueFull:
            pass  # Dropping an event is preferable to unbounded receiver memory.
        finally:
            self._pending.release()

    def stop(self) -> None:
        logger.info("Stopping event consumer...")
        if self.receiver is not None:
            self.receiver.should_stop = True
        self._stop_signal.set()
        self.join(timeout=10)
