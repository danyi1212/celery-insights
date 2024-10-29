from re import Pattern
from typing import Generator
from events.receiver import state
from tasks.model import Task
from workers.models import Worker


def search_workers(query: Pattern[str]) -> Generator[Worker, None, None]:
    for worker_hostname, worker in state.workers.items():
        if query.search(worker_hostname):
            yield Worker.from_celery_worker(worker)


def search_tasks(query: Pattern[str]) -> Generator[Task, None, None]:
    for task_id, task in state.tasks_by_time():
        if query.search(task_id):
            yield Task.from_celery_task(task)
