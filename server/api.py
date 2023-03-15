from fastapi import APIRouter, HTTPException
from starlette.requests import Request

from events.consumer import state
from events.models import EventMessage
from pagination import Paginated, get_paginated_response
from tasks.model import Task
from workers.models import Worker

api_router = APIRouter(prefix="/api", tags=["api"])


@api_router.get("/tasks")
def get_tasks(request: Request, limit: int = 1000, offset: int = 0) -> Paginated[Task]:
    items = (
        Task.from_celery_task(task)
        for _, task in state.tasks_by_time()
    )
    return get_paginated_response(items, len(state.tasks), request, limit, offset)


@api_router.get("/tasks/{task_id}", responses={404: {"model": str, "description": "Task not found."}})
def get_task_detail(task_id: str) -> Task:
    task = state.tasks.get(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found.")

    return Task.from_celery_task(task)


@api_router.get("/workers")
def get_workers(alive: bool | None = None) -> list[Worker]:
    return [
        Worker.from_celery_worker(worker)
        for worker in state.workers.itervalues()
        if alive is not None and worker.alive == alive

    ]


@api_router.get("/events")
def get_events() -> list[EventMessage]:
    return []
