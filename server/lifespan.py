import logging
import os
import time
from asyncio import CancelledError
from contextlib import asynccontextmanager

from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend

from celery_app import get_celery_app
from cleanup import CleanupJob
from events.ingester import SurrealDBIngester
from events.receiver import CeleryEventReceiver
from settings import Settings
from surrealdb_client import close_surrealdb, init_surrealdb
from tasks.result_fetcher import ResultFetcher
from workers.poller import WorkerPoller

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_):
    logger.info("Welcome to Celery Insights!")
    settings = Settings()

    # Update timezone
    os.environ["TZ"] = settings.timezone
    time.tzset()

    # Setup cache
    FastAPICache.init(InMemoryBackend())

    # 1. Initialize SurrealDB connection
    await init_surrealdb(settings)

    # 2. Connect to Celery broker
    celery_app = await get_celery_app()

    # 3. Start services: EventReceiver -> SurrealDBIngester -> WorkerPoller -> CleanupJob
    result_fetcher = ResultFetcher(celery_app)

    event_receiver = CeleryEventReceiver(celery_app)
    event_receiver.start()

    ingester = SurrealDBIngester(
        queue=event_receiver.queue,
        batch_interval_ms=settings.ingestion_batch_interval_ms,
        on_terminal=result_fetcher.fetch_and_store,
    )
    ingester.start()

    worker_poller = WorkerPoller(celery_app)
    worker_poller.start()

    cleanup_job = CleanupJob(
        interval_seconds=settings.cleanup_interval_seconds,
        task_max_count=settings.task_max_count,
        task_retention_hours=settings.task_retention_hours,
        dead_worker_retention_hours=settings.dead_worker_retention_hours,
    )
    cleanup_job.start()

    try:
        yield
    except (KeyboardInterrupt, SystemExit, CancelledError):
        logger.info("Stopping server...")
    finally:
        # Shutdown in reverse order
        cleanup_job.stop()
        worker_poller.stop()
        ingester.stop()
        event_receiver.stop()
        await close_surrealdb()
        logger.info("Goodbye! See you soon.")
