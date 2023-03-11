import logging
from asyncio import Event, Task, create_task

from events.connection_manager import ws_manager
from events.consumer import EventConsumer

logger = logging.getLogger(__name__)


class EventBroadcaster:
    def __init__(self, event_consumer: EventConsumer):
        self.event_consumer = event_consumer
        self.stop_signal = Event()
        self._task: Task | None = None

    def start(self):
        self._task = create_task(self._listen())

    async def _listen(self) -> None:
        logger.info("Starting to broadcast events...")
        while not self.stop_signal.is_set():
            logger.debug("Waiting for events to broadcast...")
            event = await self.event_consumer.queue.get()
            logger.debug(f"Broadcasting event: {event}")
            await ws_manager.broadcast(event)

    def stop(self):
        logger.info("Stopping event broadcaster...")
        self.stop_signal.set()
        if self._task.done():
            self._task.result()
        else:
            self._task.cancel()
