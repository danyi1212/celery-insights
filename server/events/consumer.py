import logging
import time
from asyncio import Queue
from threading import Event, Thread

from celery.events import EventReceiver
from celery.events.state import State

from celery_app import celery_app

logger = logging.getLogger(__name__)

state = State()


class EventConsumer(Thread):
    stop_signal = Event()
    queue = Queue()

    def start(self) -> None:
        logger.info("Starting event consumer...")
        super().start()

    def run(self) -> None:
        while not self.stop_signal.is_set():
            try:
                self.consume_events()
            except (KeyboardInterrupt, SystemExit):
                try:
                    import _thread as thread
                except ImportError:
                    import thread
                thread.interrupt_main()
            except Exception as e:
                logger.exception(f"Failed to capture events: {e}, trying again in 10 seconds.")
                time.sleep(10)

    def consume_events(self):
        logger.info("Connecting to celery cluster...")
        with celery_app.connection() as connection:
            receiver = EventReceiver(connection, handlers={
                "*": self.on_event,
            })
            logger.info("Starting to consume events...")
            for _ in receiver.itercapture():
                if self.stop_signal.is_set():
                    break

    # noinspection PyMethodMayBeStatic
    def on_event(self, event: dict) -> None:
        logger.debug(f"Received event: {event}")
        state.event(event)
        self.queue.put_nowait(event)

    def stop(self) -> None:
        logger.info("Stopping event consumer...")
        self.stop_signal.set()
        self.join()
