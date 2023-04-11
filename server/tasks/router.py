from celery.result import AsyncResult
from fastapi import APIRouter, HTTPException
from fastapi_cache.decorator import cache
from starlette.requests import Request

from celery_app import celery_app
from events.receiver import state
from pagination import Paginated, get_paginated_response
from tasks.model import Task, TaskResult

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


@tasks_router.get("/{task_id}/result", responses={404: {"model": str, "description": "Task not found."}})
@cache(expire=5)
def get_task_result(task_id: str) -> TaskResult:
    result = AsyncResult(task_id, app=celery_app)
    return TaskResult(
        id=result.id,
        type=result.name,
        state=result.state,
        queue=result.queue,
        result=result.result,
        traceback=str(result.traceback) if result.traceback is not None else None,
        ignored=result.ignored,
        args=result.args or [],
        kwargs=result.kwargs or {},
        retries=result.retries or 0,
        worker=result.worker,
    )
