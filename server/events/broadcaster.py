import asyncio
import json
import logging

from events.exceptions import InconsistentStateStoreError, InvalidEventError
from events.models import EventCategory, EventMessage, EventType
from events.receiver import state
from events.subscriber import QueueSubscriber
from tasks.model import Task
from workers.models import Worker
from ws.managers import events_manager, raw_events_manager

logger = logging.getLogger(__name__)


class EventBroadcaster(QueueSubscriber[dict]):
    async def handle_event(self, event: dict) -> None:
        await asyncio.gather(
            broadcast_raw_event(event),
            broadcast_parsed_event(event),
        )


async def broadcast_raw_event(event: dict) -> None:
    logger.debug(f"Broadcasting raw event of type {event.get('type', 'UNKNOWN')!r}")
    try:
        await raw_events_manager.broadcast(json.dumps(event))
    except Exception as e:
        logger.exception(f"Failed to broadcast raw event: {e}")


async def broadcast_parsed_event(event: dict) -> None:
    try:
        message = parse_event(event)
    except InvalidEventError as e:
        logger.warning(f"Event object is invalid, failed to parse: {e}", exc_info=True)
    except InconsistentStateStoreError as e:
        logger.exception(f"Inconsistent event state store: {e}")
    except Exception as e:
        logger.exception(f"Failed to parse event message: {e}")
    else:
        logger.debug(f"Broadcasting event {message.type.value!r}")
        try:
            await events_manager.broadcast(message.model_dump_json())
        except Exception as e:
            logger.exception(f"Failed to broadcast event: {e}")


def parse_event(event: dict) -> EventMessage:
    event_type = event.get("type")
    if event_type is None:
        raise InvalidEventError(f"Received event without type: {event}")

    event_category, _ = event_type.split("-", 1)
    state.event(event)
    if event_category == "task":
        return parse_task_event(event, event_type)
    elif event_category == "worker":
        return parse_worker_event(event, event_type)
    else:
        raise InvalidEventError(f"Unknown event category {event_category!r}")


def parse_worker_event(event: dict, event_type: str) -> EventMessage | None:
    worker_hostname = event.get("hostname")
    if worker_hostname is None:
        raise InvalidEventError(f"Worker event {event_type!r} is missing hostname: {event}")

    state_worker = state.workers.get(worker_hostname)
    if state_worker is None:
        raise InconsistentStateStoreError(f"Could not find worker {worker_hostname!r} in state")

    worker = Worker.from_celery_worker(state_worker)
    return EventMessage(
        type=EventType(event_type),
        category=EventCategory.WORKER,
        data=worker,
    )


def parse_task_event(event: dict, event_type: str) -> EventMessage | None:
    task_id = event.get("uuid")
    if task_id is None:
        raise InvalidEventError(f"Task event {event_type!r} is missing uuid: {event}")

    state_task = state.tasks.get(task_id)
    if state_task is None:
        raise InconsistentStateStoreError(f"Could not find task {task_id!r} in state")

    task = Task.from_celery_task(state_task)
    return EventMessage(
        type=EventType(event_type),
        category=EventCategory.TASK,
        data=task,
    )
