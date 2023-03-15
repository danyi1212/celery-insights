import asyncio

from celery.app.control import Inspect
from fastapi import APIRouter, Depends

from events.consumer import state
from workers.dependencies import get_inspect
from workers.models import Stats, Worker

workers_router = APIRouter(prefix="/api/workers", tags=["workers"])


@workers_router.get("")
def get_workers(alive: bool | None = None) -> list[Worker]:
    return [
        Worker.from_celery_worker(worker)
        for worker in state.workers.itervalues()
        if alive is not None and worker.alive == alive

    ]


@workers_router.get("/workers/stats", description="Worker Statistics")
async def get_worker_stats(inspect: Inspect = Depends(get_inspect)) -> dict[str, Stats]:
    return await asyncio.to_thread(inspect.stats)
