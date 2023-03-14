import logging
from asyncio import Event, Task as AioTask, create_task

from events.connection_manager import ws_manager
from events.consumer import EventConsumer, state
from events.models import EventCategory, EventMessage, TaskEventMessage, WorkerEventMessage
from tasks.model import Task
from workers.models import Worker

logger = logging.getLogger(__name__)


class EventBroadcaster:
    def __init__(self, event_consumer: EventConsumer):
        self.event_consumer = event_consumer
        self.stop_signal = Event()
        self._task: AioTask | None = None

    def start(self):
        self._task = create_task(self._listen())

    async def _listen(self) -> None:
        logger.info("Starting to broadcast events...")
        while not self.stop_signal.is_set():
            logger.debug("Waiting for events to broadcast...")
            event = await self.event_consumer.queue.get()
            try:
                message = self.handle_event(event)
            except Exception as e:
                logger.exception(f"Failed to generate event message for event {event}: {e}")
            else:
                if message is not None:
                    logger.debug(f"Broadcasting event {message.type.value}")
                    await ws_manager.broadcast(message.json())
                else:
                    logger.warning("Ignored event as no message was specified")

    @staticmethod
    def handle_event(event: dict) -> EventMessage | None:
        event_type = event.get('type')
        if event_type is None:
            logger.warning(f"Received event without type: {event}")
            return None

        event_category, _ = event_type.split("-", 1)
        state.event(event)
        if event_category == "task":
            return EventBroadcaster.handle_task_event(event, event_type)
        elif event_category == "worker":
            return EventBroadcaster.handle_worker_event(event, event_type)
        else:
            logger.error(f"Unknown event category {event_category}")
            return None

    @staticmethod
    def handle_worker_event(event: dict, event_type) -> WorkerEventMessage | None:
        worker_hostname = event.get("hostname")
        if worker_hostname is None:
            logger.warning(f"Worker event {event_type} is missing hostname: {event}")
            return None
        state_worker = state.workers.get(worker_hostname)
        if state_worker is None:
            logger.warning(f"Could not find worker {worker_hostname} in state")
            return None
        worker = Worker.from_celery_worker(state_worker)
        return WorkerEventMessage(
            type=event_type,
            category=EventCategory.WORKER,
            worker=worker,
        )

    @staticmethod
    def handle_task_event(event: dict, event_type) -> TaskEventMessage | None:
        task_id = event.get("uuid")
        if task_id is None:
            logger.warning(f"Task event {event_type} is missing uuid: {event}")
            return None
        state_task = state.tasks.get(task_id)
        if state_task is None:
            logger.warning(f"Could not find task {task_id} in state")
            return None
        task = Task.from_celery_task(state_task)
        return TaskEventMessage(
            type=event_type,
            category=EventCategory.TASK,
            task=task,
        )

    def stop(self):
        logger.info("Stopping event broadcaster...")
        self.stop_signal.set()
        if self._task.done():
            self._task.result()
        else:
            self._task.cancel()
