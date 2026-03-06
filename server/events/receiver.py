import asyncio
import logging
import time
from threading import Event, Thread

from celery import Celery
from celery.events import EventReceiver

logger = logging.getLogger(__name__)


class CeleryEventReceiver(Thread):
    """Thread for consuming events from a Celery cluster."""

    def __init__(self, app: Celery, loop: asyncio.AbstractEventLoop):
        super().__init__(daemon=True)
        self.app = app
        self._loop = loop
        self._stop_signal = Event()
        self.queue: asyncio.Queue[dict] = asyncio.Queue()
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
            self.receiver = EventReceiver(
                channel=connection,
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
        self._loop.call_soon_threadsafe(self.queue.put_nowait, event)
        if self._stop_signal.is_set():
            raise KeyboardInterrupt("Stop signal received")

    def stop(self) -> None:
        logger.info("Stopping event consumer...")
        if self.receiver is not None:
            self.receiver.should_stop = True
        self._stop_signal.set()
        self.join(timeout=10)
