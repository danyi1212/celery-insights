from celery.app.control import Inspect

from celery_app import get_celery_app


from typing import Optional, List


async def get_inspect(timeout: int = 10, worker: Optional[str] = None) -> Inspect:
    worker_list: Optional[List[str]] = [worker] if worker is not None else None
    celery_app = await get_celery_app()
    return Inspect(app=celery_app, timeout=timeout, destination=worker_list)
