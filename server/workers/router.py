from fastapi import APIRouter

from events.consumer import state
from workers.models import Worker

workers_router = APIRouter(prefix="/api/workers", tags=["workers"])


@workers_router.get("")
def get_workers(alive: bool | None = None) -> list[Worker]:
    return [
        Worker.from_celery_worker(worker)
        for worker in state.workers.itervalues()
        if alive is not None and worker.alive == alive

    ]
