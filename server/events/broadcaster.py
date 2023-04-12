import logging

from events.connection_manager import ws_manager
from events.models import EventCategory, EventMessage, EventType, TaskEventMessage, WorkerEventMessage
from events.receiver import state
from events.subscriber import QueueSubscriber
from tasks.model import Task
from workers.models import Worker

logger = logging.getLogger(__name__)


class EventBroadcaster(QueueSubscriber[dict]):
    async def handle_event(self, event: dict) -> None:
        try:
            message = parse_event(event)
        except Exception as e:
            logger.exception(f"Failed to generate event message: {e}")
        else:
            if message is not None:
                logger.debug(f"Broadcasting event {message.type.value!r}")
                try:
                    await ws_manager.broadcast(message.json())
                except Exception as e:
                    logger.exception(f"Failed to broadcast event: {e}")
            else:
                logger.warning("Ignored event as no message was specified")


def parse_event(event: dict) -> EventMessage | None:
    event_type = event.get('type')
    if event_type is None:
        logger.warning(f"Received event without type: {event}")
        return None

    event_category, _ = event_type.split("-", 1)
    state.event(event)
    if event_category == "task":
        return parse_task_event(event, event_type)
    elif event_category == "worker":
        return parse_worker_event(event, event_type)
    else:
        logger.error(f"Unknown event category {event_category!r}")
        return None


def parse_worker_event(event: dict, event_type: str) -> WorkerEventMessage | None:
    worker_hostname = event.get("hostname")
    if worker_hostname is None:
        logger.warning(f"Worker event {event_type!r} is missing hostname: {event}")
        return None
    state_worker = state.workers.get(worker_hostname)
    if state_worker is None:
        logger.warning(f"Could not find worker {worker_hostname!r} in state")
        return None
    worker = Worker.from_celery_worker(state_worker)
    return WorkerEventMessage(
        type=EventType(event_type),
        category=EventCategory.WORKER,
        worker=worker,
    )


def parse_task_event(event: dict, event_type: str) -> TaskEventMessage | None:
    task_id = event.get("uuid")
    if task_id is None:
        logger.warning(f"Task event {event_type!r} is missing uuid: {event}")
        return None
    state_task = state.tasks.get(task_id)
    if state_task is None:
        logger.warning(f"Could not find task {task_id!r} in state")
        return None
    task = Task.from_celery_task(state_task)
    return TaskEventMessage(
        type=EventType(event_type),
        category=EventCategory.TASK,
        task=task,
    )
