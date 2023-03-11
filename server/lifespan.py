from contextlib import asynccontextmanager

from events.broadcaster import EventBroadcaster
from events.consumer import EventConsumer


@asynccontextmanager
async def lifespan(_):
    event_consumer = EventConsumer()
    event_consumer.start()
    listener = EventBroadcaster(event_consumer)
    listener.start()
    try:
        yield
    finally:
        event_consumer.stop()
        listener.stop()
