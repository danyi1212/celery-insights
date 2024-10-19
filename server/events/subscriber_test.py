from asyncio import Queue, sleep

import pytest
from pytest_mock import MockerFixture

from events.subscriber import QueueSubscriber


class FakeQueueSubscriber(QueueSubscriber[int]):
    async def handle_event(self, event: int) -> None:
        pass


@pytest.fixture()
def subscriber() -> FakeQueueSubscriber:
    return FakeQueueSubscriber(Queue())


@pytest.mark.asyncio
async def test_queue_subscriber_start_stop(subscriber: FakeQueueSubscriber) -> None:
    subscriber.start()
    assert not subscriber._stop_signal.is_set()
    subscriber.stop()
    assert subscriber._stop_signal.is_set()


@pytest.mark.asyncio
async def test_queue_subscriber_handle_event(subscriber: FakeQueueSubscriber) -> None:
    subscriber.start()
    event = 123
    subscriber.queue.put_nowait(event)
    await sleep(0.001)  # Wait for the event to be processed
    assert not subscriber.queue.qsize()
    subscriber.stop()


@pytest.mark.asyncio
async def test_queue_subscriber_exception_handling(
    subscriber: FakeQueueSubscriber, mocker: MockerFixture, caplog: pytest.LogCaptureFixture
) -> None:
    subscriber.start()
    event = 123
    mocker.patch.object(subscriber, "handle_event", side_effect=Exception("test exception"))
    subscriber.queue.put_nowait(event)
    await sleep(0.001)  # Wait for the event to be processed
    assert "Failed to handle event: test exception" in caplog.text
    subscriber.stop()


@pytest.mark.asyncio
async def test_queue_subscriber_cancel(subscriber: FakeQueueSubscriber, mocker: MockerFixture) -> None:
    subscriber.start()
    cancel_mock = mocker.patch.object(subscriber._task, "cancel")
    subscriber.stop()
    cancel_mock.assert_called_once()
