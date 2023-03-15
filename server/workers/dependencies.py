from celery.app.control import Inspect

from celery_app import celery_app


def get_inspect(timeout: int = 10, worker: str | None = None) -> Inspect:
    worker = [worker] if worker is not None else None
    return Inspect(app=celery_app, timeout=timeout, destination=worker)
