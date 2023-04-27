from contextlib import asynccontextmanager

from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend

from celery_app import get_celery_app
from events.broadcaster import EventBroadcaster
from events.receiver import CeleryEventReceiver


@asynccontextmanager
async def lifespan(_):
    FastAPICache.init(InMemoryBackend())
    celery_app = await get_celery_app()
    event_consumer = CeleryEventReceiver(celery_app)
    event_consumer.start()
    listener = EventBroadcaster(event_consumer.queue)
    listener.start()
    try:
        yield
    finally:
        event_consumer.stop()
        listener.stop()
