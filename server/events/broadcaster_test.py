from asyncio import Queue

import pytest
from polyfactory import Ignore
from polyfactory.factories.pydantic_factory import ModelFactory
from pytest_mock import MockerFixture

from events.broadcaster import EventBroadcaster, parse_event, parse_task_event, parse_worker_event
from events.models import EventCategory, EventMessage, EventType
from events.receiver import state
from tasks.model import Task
from workers.models import Worker
from ws.managers import events_manager


class EventMessageFactory(ModelFactory[EventMessage]):
    __model__ = EventMessage


class WorkerFactory(ModelFactory[Worker]):
    __model__ = Worker
    cpu_load = Ignore()


class TaskFactory(ModelFactory[Task]):
    __model__ = Task


@pytest.fixture()
def broadcaster():
    return EventBroadcaster(Queue())


@pytest.mark.asyncio
async def test_broadcasts_event(broadcaster, mocker: MockerFixture):
    message = EventMessageFactory.build()
    parse_event_mock = mocker.patch("events.broadcaster.parse_event", return_value=message)
    broadcast_mock = mocker.patch.object(events_manager, "broadcast")
    event = {"type": "task-succeeded", "task_id": "1234", "result": "foo"}

    await broadcaster.handle_event(event)

    parse_event_mock.assert_called_once_with(event)
    broadcast_mock.assert_called_once_with(message.json())


@pytest.mark.asyncio
async def test_event_parsing_failure(broadcaster, mocker: MockerFixture):
    parse_event_mock = mocker.patch("events.broadcaster.parse_event", side_effect=Exception("Parsing failed"))
    broadcast_mock = mocker.patch.object(events_manager, "broadcast")
    event = {"type": "task-succeeded", "task_id": "1234", "result": "foo"}

    await broadcaster.handle_event(event)

    parse_event_mock.assert_called_once_with(event)
    broadcast_mock.assert_not_called()


@pytest.mark.asyncio
async def test_no_message_specified(broadcaster, mocker: MockerFixture):
    parse_event_mock = mocker.patch("events.broadcaster.parse_event", return_value=None)
    broadcast_mock = mocker.patch.object(events_manager, "broadcast")
    event = {"type": "task-succeeded", "task_id": "1234", "result": "foo"}

    await broadcaster.handle_event(event)

    parse_event_mock.assert_called_once_with(event)
    broadcast_mock.assert_not_called()


@pytest.mark.asyncio
async def test_broadcast_failure(broadcaster, mocker: MockerFixture):
    message = EventMessageFactory.build()
    parse_event_mock = mocker.patch("events.broadcaster.parse_event", return_value=message)
    broadcast_mock = mocker.patch.object(events_manager, "broadcast", side_effect=Exception("Broadcast failed"))
    event = {"type": "task-succeeded", "task_id": "1234", "result": "foo"}

    await broadcaster.handle_event(event)

    parse_event_mock.assert_called_once_with(event)
    broadcast_mock.assert_called_once_with(message.json())


def test_parse_event_no_type():
    event = {}
    assert parse_event(event) is None


def test_parse_event_unknown_category(caplog: pytest.LogCaptureFixture):
    event = {"type": "foo-bar"}
    assert parse_event(event) is None
    assert "Unknown event category 'foo'" in caplog.text


def test_parse_worker_event_missing_hostname(caplog: pytest.LogCaptureFixture):
    event = {"type": "worker-started"}
    assert parse_worker_event(event, "worker-started") is None
    assert "Worker event 'worker-started' is missing hostname" in caplog.text


def test_parse_worker_event_missing_worker(caplog: pytest.LogCaptureFixture):
    event = {"type": "worker-started", "hostname": "worker"}
    assert parse_worker_event(event, "worker-started") is None
    assert "Could not find worker 'worker' in state" in caplog.text


def test_parse_task_event_missing_uuid(caplog: pytest.LogCaptureFixture):
    event = {"type": "task-started"}
    assert parse_task_event(event, "task-started") is None
    assert "Task event 'task-started' is missing uuid" in caplog.text


def test_parse_task_event_missing_task(caplog: pytest.LogCaptureFixture):
    event = {"type": "task-started", "uuid": "task"}
    assert parse_task_event(event, "task-started") is None
    assert "Could not find task 'task' in state" in caplog.text


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
