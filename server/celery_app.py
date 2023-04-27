from celery import Celery

from settings import Settings


def get_celery_app():
    settings = Settings()
    return Celery(
        broker=settings.broker_url,
        backend=settings.result_backend,
    )
