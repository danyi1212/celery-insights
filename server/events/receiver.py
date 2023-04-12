import asyncio
import logging
import time
from threading import Event, Thread

from celery import Celery
from celery.events import EventReceiver
from celery.events.state import State

logger = logging.getLogger(__name__)

state = State()


class CeleryEventReceiver(Thread):
    """Thread for consuming events from a Celery cluster."""

    def __init__(self, app: Celery):
        super().__init__()
        self.app = app
        self._stop_signal = Event()
        self.queue = asyncio.Queue()
        self.receiver: EventReceiver | None = None

    def run(self) -> None:
        logger.info("Starting event consumer...")
        while not self._stop_signal.is_set():
            try:
                self.consume_events()
            except (KeyboardInterrupt, SystemExit):
                raise
            except Exception as e:
                logger.exception(f"Failed to capture events: {e}, trying again in 10 seconds.")
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
        state.event(event)
        self.queue.put_nowait(event)
        if self._stop_signal.is_set():
            raise KeyboardInterrupt("Stop signal received")

    def stop(self) -> None:
        logger.info("Stopping event consumer...")
        if self.receiver is not None:
            self.receiver.should_stop = True
        self._stop_signal.set()
        self.join()
