import pytest
from pytest_mock import MockerFixture

from celery_app import celery_app
from events.receiver import CeleryEventReceiver, state


@pytest.fixture
def receiver():
    return CeleryEventReceiver(celery_app)


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
def test_adds_event_to_queue(receiver, should_stop, mocker: MockerFixture):
    event = {"type": "task-succeeded", "task_id": "1234", "result": "foo"}
    state_mock = mocker.patch.object(state, "event")
    if should_stop:
        receiver._stop_signal.set()

    if should_stop:
        with pytest.raises(KeyboardInterrupt):
            receiver.on_event(event)
    else:
        receiver.on_event(event)

    assert not receiver.queue.empty()
    assert receiver.queue.get_nowait() == event
    state_mock.assert_called_once_with(event)
