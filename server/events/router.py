from fastapi import APIRouter

from events.models import EventMessage

events_router = APIRouter(prefix="/api/events", tags=["events"])


@events_router.get("")
async def get_events() -> list[EventMessage]:
    return []
