import asyncio

import pytest
from celery import Celery
from pytest_mock import MockerFixture

from events.receiver import CeleryEventReceiver


@pytest.fixture
def receiver():
    celery_app = Celery()
    loop = asyncio.new_event_loop()
    recv = CeleryEventReceiver(celery_app, loop)
    yield recv
    loop.close()


def test_stop_with_receiver(receiver, mocker: MockerFixture):
    join_mock = mocker.patch.object(receiver, "join")
    receiver.receiver = mocker.Mock()

    receiver.stop()

    assert receiver.receiver.should_stop
    assert receiver._stop_signal.is_set()
    join_mock.assert_called_once()


def test_stop_without_receiver(receiver, mocker: MockerFixture):
    join_mock = mocker.patch.object(receiver, "join")

    receiver.stop()

    assert receiver.receiver is None
    assert receiver._stop_signal.is_set()
    join_mock.assert_called_once()


@pytest.mark.parametrize("should_stop", [True, False])
def test_adds_event_to_queue(receiver, should_stop):
    event = {"type": "task-succeeded", "task_id": "1234", "result": "foo"}
    if should_stop:
        receiver._stop_signal.set()

    if should_stop:
        with pytest.raises(KeyboardInterrupt):
            receiver.on_event(event)
    else:
        receiver.on_event(event)

    # on_event schedules put_nowait via call_soon_threadsafe; run pending callbacks
    receiver._loop.run_until_complete(asyncio.sleep(0))

    assert not receiver.queue.empty()
    assert receiver.queue.get_nowait() == event
