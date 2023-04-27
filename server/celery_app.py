import importlib.util
import logging

from aiopath import AsyncPath
from celery import Celery

from settings import Settings

logger = logging.getLogger(__name__)
_celery_app_cache: Celery | None = None


async def get_celery_app(settings: Settings | None = None):
    global _celery_app_cache
    if _celery_app_cache is not None:
        return _celery_app_cache

    settings = settings or Settings()

    config_path = AsyncPath(settings.config_path)
    if not await config_path.exists():
        logger.info("Loading celery app config from environment variables")
        app = Celery(
            broker=settings.broker_url,
            backend=settings.result_backend,
        )
        _celery_app_cache = app
        return app

    if not await config_path.is_file():
        raise RuntimeError(f"Config file path is not a file: {settings.config_path!r}")

    logger.info(f"Loading celery app config from {settings.config_path!r}")
    app = Celery()
    try:
        spec = importlib.util.spec_from_file_location("config", str(config_path))
        config = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(config)
        app.config_from_object(config)
    except Exception as e:
        logger.exception(f"Failed to load celery app config from {settings.config_path!r}: {e}")
    else:
        _celery_app_cache = app
        return app
