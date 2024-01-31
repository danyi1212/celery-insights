import asyncio
import inspect
import logging
from typing import Callable, Coroutine, Never, Union

from celery.canvas import Signature

from app import order_workflow

logger = logging.getLogger(__name__)
Callback = Union[Callable[..., Coroutine], Callable[..., None]]


async def timer(interval: float, callback: Callback, stop_signal: asyncio.Event) -> Never:
    """An asynchronous timer that triggers a callback at a given interval and stops when signalled."""
    while not stop_signal.is_set():
        if inspect.iscoroutinefunction(callback):
            await callback()
        else:
            callback()

        await asyncio.sleep(interval)


def publish(signature: Signature) -> None:
    logger.info(f"Published {signature.name}")
    signature.apply_async()


async def main():
    stop_signal = asyncio.Event()

    logger.info("Starting producer...")
    async with asyncio.TaskGroup() as tg:
        tg.create_task(timer(10, lambda: publish(order_workflow.si()), stop_signal))


if __name__ == "__main__":
    asyncio.run(main())
