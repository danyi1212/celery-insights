import logging
import importlib.util

from aiopath import AsyncPath
from celery import Celery

from settings import Settings

logger = logging.getLogger(__name__)


async def get_celery_app(settings: Settings | None = None):
    settings = settings or Settings()

    config_path = AsyncPath(settings.config_path)
    if not await config_path.exists():
        logger.info("Loading celery app config from environment variables")
        return Celery(
            broker=settings.broker_url,
            backend=settings.result_backend,
        )

    if not await config_path.is_file():
        raise RuntimeError(f"Config file path is not a file: {settings.config_path!r}")

    logger.info(f"Loading celery app config from {settings.config_path!r}")
    celery = Celery()
    try:
        spec = importlib.util.spec_from_file_location("config", str(config_path))
        config = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(config)
        celery.config_from_object(config)
    except Exception as e:
        logger.exception(f"Failed to load celery app config from {settings.config_path!r}: {e}")
    else:
        return celery
