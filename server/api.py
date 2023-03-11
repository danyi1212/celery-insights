from fastapi import APIRouter

from events.consumer import state

api_router = APIRouter(prefix="/api", tags=["api"])


@api_router.get("/tasks")
def get_tasks():
    return state.tasks


@api_router.get("/workers")
def get_workers():
    return state.workers
