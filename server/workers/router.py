import asyncio

from celery.app.control import Inspect
from fastapi import APIRouter, Depends
from fastapi_cache.decorator import cache

from events.receiver import state
from workers.dependencies import get_inspect
from workers.models import QueueInfo, ScheduledTask, Stats, TaskRequest, Worker

workers_router = APIRouter(prefix="/api/workers", tags=["workers"])


@workers_router.get("")
async def get_workers(alive: bool | None = None) -> list[Worker]:
    return [
        Worker.from_celery_worker(worker)
        for worker in state.workers.itervalues()
        if alive is None or worker.alive == alive
    ]


@workers_router.get("/stats", description="Worker Statistics")
@cache(expire=5)
async def get_worker_stats(inspect: Inspect = Depends(get_inspect)) -> dict[str, Stats]:  # noqa: B008
    return await asyncio.to_thread(inspect.stats) or {}


@workers_router.get("/registered", description="Worker Registered Task Types")
@cache(expire=5)
async def get_worker_registered(inspect: Inspect = Depends(get_inspect)) -> dict[str, list[str]]:  # noqa: B008
    return await asyncio.to_thread(inspect.registered) or {}


@workers_router.get("/revoked", description="Worker Revoked Tasks list")
@cache(expire=5)
async def get_worker_revoked(inspect: Inspect = Depends(get_inspect)) -> dict[str, list[str]]:  # noqa: B008
    return await asyncio.to_thread(inspect.revoked) or {}


@workers_router.get("/scheduled", description="Worker Scheduled Tasks (eta / countdown)")
@cache(expire=1)
async def get_worker_scheduled(inspect: Inspect = Depends(get_inspect)) -> dict[str, list[ScheduledTask]]:  # noqa: B008
    return await asyncio.to_thread(inspect.scheduled) or {}


@workers_router.get("/reserved", description="Worker Prefetched Tasks")
@cache(expire=1)
async def get_worker_reserved(inspect: Inspect = Depends(get_inspect)) -> dict[str, list[TaskRequest]]:  # noqa: B008
    return await asyncio.to_thread(inspect.reserved) or {}


@workers_router.get("/active", description="Worker currently executing tasks")
@cache(expire=1)
async def get_worker_active(inspect: Inspect = Depends(get_inspect)) -> dict[str, list[TaskRequest]]:  # noqa: B008
    return await asyncio.to_thread(inspect.active) or {}


@workers_router.get("/queues", description="Worker active consumer queues")
@cache(expire=5)
async def get_worker_queues(inspect: Inspect = Depends(get_inspect)) -> dict[str, list[QueueInfo]]:  # noqa: B008
    return await asyncio.to_thread(inspect.active_queues) or {}
