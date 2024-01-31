import json
from asyncio import Queue

import pytest
from pytest_mock import MockerFixture

from events.broadcaster import EventBroadcaster, parse_event, parse_task_event, parse_worker_event
from events.exceptions import InconsistentStateStoreError, InvalidEventError
from events.factories import EventMessageFactory
from events.models import EventCategory, EventMessage, EventType
from events.receiver import state
from tasks.factories import TaskFactory
from workers.factories import WorkerFactory
from ws.managers import events_manager


@pytest.fixture()
def broadcaster():
    return EventBroadcaster(Queue())


@pytest.mark.asyncio
async def test_broadcasts_event(broadcaster, mocker: MockerFixture):
    event = {"type": "task-succeeded", "task_id": "1234", "result": "foo"}
    raw_event_mock = mocker.patch("events.broadcaster.broadcast_raw_event")
    parsed_event_mock = mocker.patch("events.broadcaster.broadcast_parsed_event")

    await broadcaster.handle_event(event)

    raw_event_mock.assert_called_once_with(event)
    parsed_event_mock.assert_called_once_with(event)


@pytest.mark.asyncio
async def test_broadcast_failure(broadcaster, mocker: MockerFixture):
    event = {"type": "task-succeeded", "task_id": "1234", "result": "foo"}
    message = EventMessageFactory.build()
    parse_event_mock = mocker.patch("events.broadcaster.parse_event", return_value=message)
    broadcast_mock = mocker.patch("ws.websocket_manager.WebsocketManager.broadcast")
    broadcast_mock.side_effect = Exception("Broadcast failed")

    await broadcaster.handle_event(event)

    assert broadcast_mock.call_args_list == [mocker.call(json.dumps(event)), mocker.call(message.model_dump_json())]
    parse_event_mock.assert_called_once_with(event)


@pytest.mark.asyncio
async def test_broadcast_parsed_event(broadcaster, mocker: MockerFixture):
    message = EventMessageFactory.build()
    parse_event_mock = mocker.patch("events.broadcaster.parse_event", return_value=message)
    broadcast_mock = mocker.patch.object(events_manager, "broadcast")
    event = {"type": "task-succeeded", "task_id": "1234", "result": "foo"}

    await broadcaster.handle_event(event)

    parse_event_mock.assert_called_once_with(event)
    broadcast_mock.assert_called_once_with(message.model_dump_json())


@pytest.mark.asyncio
async def test_event_parsing_failure(broadcaster, mocker: MockerFixture):
    event = {"type": "task-succeeded", "task_id": "1234", "result": "foo"}
    parse_event_mock = mocker.patch("events.broadcaster.parse_event", side_effect=Exception("Parsing failed"))
    broadcast_mock = mocker.patch.object(events_manager, "broadcast")

    await broadcaster.handle_event(event)

    parse_event_mock.assert_called_once_with(event)
    broadcast_mock.assert_not_called()


@pytest.mark.parametrize(
    "event,match",
    [
        ({}, "Received event without type"),
        ({"type": "foo-bar"}, "Unknown event category 'foo'"),
        ({"type": "task-started"}, "Task event 'task-started' is missing uuid"),
        ({"type": "worker-started"}, "Worker event 'worker-started' is missing hostname"),
    ],
)
def test_parse_invalid_event(event, match, mocker: MockerFixture):
    mocker.patch.object(state, "event")

    with pytest.raises(InvalidEventError, match=match):
        parse_event(event)


@pytest.mark.parametrize(
    "event,match",
    [
        ({"type": "worker-started", "hostname": "worker"}, "Could not find worker 'worker' in state"),
        ({"type": "task-started", "uuid": "task"}, "Could not find task 'task' in state"),
    ],
)
def test_parse_event_missing_object(event, match, mocker: MockerFixture):
    mocker.patch.object(state, "event")
    mocker.patch.object(state.tasks, "get", return_value=None)
    mocker.patch.object(state.workers, "get", return_value=None)

    with pytest.raises(InconsistentStateStoreError, match=match):
        parse_event(event)


def test_parse_worker_event(mocker: MockerFixture):
    state_worker = object()
    state_mock = mocker.patch.object(state.workers, "get", return_value=state_worker)

    worker = WorkerFactory.build()
    cast_mock = mocker.patch("workers.models.Worker.from_celery_worker", return_value=worker)
    event = {"hostname": "test"}

    actual = parse_worker_event(event, EventType.WORKER_ONLINE.value)

    state_mock.assert_called_once_with("test")
    cast_mock.assert_called_once_with(state_worker)
    assert actual == EventMessage(
        type=EventType.WORKER_ONLINE,
        category=EventCategory.WORKER,
        data=worker,
    )


def test_parse_task_event(mocker: MockerFixture):
    state_task = object()
    state_mock = mocker.patch.object(state.tasks, "get", return_value=state_task)

    task = TaskFactory.build()
    cast_mock = mocker.patch("tasks.model.Task.from_celery_task", return_value=task)
    event = {"uuid": "test"}

    actual = parse_task_event(event, EventType.TASK_STARTED.value)

    state_mock.assert_called_once_with("test")
    cast_mock.assert_called_once_with(state_task)
    assert actual == EventMessage(
        type=EventType.TASK_STARTED,
        category=EventCategory.TASK,
        data=task,
    )
