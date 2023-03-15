from fastapi import APIRouter, HTTPException
from starlette.requests import Request

from events.consumer import state
from pagination import Paginated, get_paginated_response
from tasks.model import Task

tasks_router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@tasks_router.get("")
def get_tasks(request: Request, limit: int = 1000, offset: int = 0) -> Paginated[Task]:
    items = (
        Task.from_celery_task(task)
        for _, task in state.tasks_by_time()
    )
    return get_paginated_response(items, len(state.tasks), request, limit, offset)


@tasks_router.get("/{task_id}", responses={404: {"model": str, "description": "Task not found."}})
def get_task_detail(task_id: str) -> Task:
    task = state.tasks.get(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found.")

    return Task.from_celery_task(task)
