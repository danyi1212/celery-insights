from fastapi import APIRouter
from starlette.requests import Request

from events.consumer import state
from pagination import Paginated, get_paginated_response
from tasks.model import Task

api_router = APIRouter(prefix="/api", tags=["api"])


@api_router.get("/tasks")
def get_tasks(request: Request, limit: int = 1000, offset: int = 0) -> Paginated[Task]:
    items = (
        Task.from_celery_task(task)
        for _, task in state.tasks_by_time()
    )
    return get_paginated_response(items, len(state.tasks), request, limit, offset)


@api_router.get("/workers")
def get_workers():
    return state.workers
