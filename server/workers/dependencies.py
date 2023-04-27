from celery.app.control import Inspect

from celery_app import get_celery_app


def get_inspect(timeout: int = 10, worker: str | None = None) -> Inspect:
    worker = [worker] if worker is not None else None
    celery_app = get_celery_app()
    return Inspect(app=celery_app, timeout=timeout, destination=worker)
