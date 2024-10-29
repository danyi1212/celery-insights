import logging
import os
import time
from typing import Any, AsyncGenerator
from asyncio import CancelledError
from contextlib import asynccontextmanager

from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend

from celery_app import get_celery_app
from events.broadcaster import EventBroadcaster
from events.receiver import CeleryEventReceiver
from settings import Settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: Any) -> AsyncGenerator[None, None]:
    logger.info("Welcome to Celery Insights!")
    settings = Settings()

    # Update timezone
    os.environ["TZ"] = settings.timezone
    time.tzset()

    # Setup cache
    FastAPICache.init(InMemoryBackend())

    # Start consuming events
    celery_app = await get_celery_app()
    event_consumer = CeleryEventReceiver(celery_app)
    event_consumer.start()

    # Start broadcasting events
    listener = EventBroadcaster(event_consumer.queue)
    listener.start()

    try:
        yield
    except (KeyboardInterrupt, SystemExit, CancelledError):
        logger.info("Stopping server...")
    finally:
        event_consumer.stop()
        listener.stop()
        logger.info("Goodbye! See you soon.")
