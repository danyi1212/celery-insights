from celery import Celery

from settings import settings

celery_app = Celery(
    broker=settings.broker,
    backend=settings.result_backend,
)
