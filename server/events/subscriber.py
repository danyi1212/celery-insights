import logging
from abc import ABC, abstractmethod
from asyncio import CancelledError, Event, Queue, Task as AioTask, create_task
from typing import Generic, TypeVar

logger = logging.getLogger(__name__)
T = TypeVar("T")


class QueueSubscriber(Generic[T], ABC):
    def __init__(self, queue: Queue[T], name: str | None = None):
        self.queue = queue
        self.name = name or self.__class__.__name__
        self._stop_signal = Event()
        self._task: AioTask | None = None

    def start(self):
        self._task = create_task(self._listen())

    async def _listen(self) -> None:
        logger.info(f"Subscribing to events from {self.name!r}...")
        while not self._stop_signal.is_set():
            try:
                event = await self.queue.get()
            except CancelledError:
                break
            else:
                logger.debug(f"Received event from {self.name!r}: {event}")
                try:
                    await self.handle_event(event)
                except Exception as e:
                    logger.exception(f"Failed to handle event: {e}")

    @abstractmethod
    async def handle_event(self, event: T) -> None:
        raise NotImplementedError()

    def stop(self):
        logger.info(f"Stopping subscriber {self.name!r}...")
        self._stop_signal.set()
        if self._task.done():
            self._task.result()
        else:
            self._task.cancel()
