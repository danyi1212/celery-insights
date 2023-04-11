from contextlib import asynccontextmanager

from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend

from events.broadcaster import EventBroadcaster
from events.consumer import CeleryEventReceiver


@asynccontextmanager
async def lifespan(_):
    FastAPICache.init(InMemoryBackend())
    event_consumer = CeleryEventReceiver()
    event_consumer.start()
    listener = EventBroadcaster(event_consumer)
    listener.start()
    try:
        yield
    finally:
        event_consumer.stop()
        listener.stop()
