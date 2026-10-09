import asyncio
import logging
import os
import time
from asyncio import CancelledError
from contextlib import asynccontextmanager


from celery_app import get_celery_app
from events.ingester import SurrealDBIngester
from events.receiver import CeleryEventReceiver
from settings import get_settings
from surrealdb_client import close_surrealdb, init_surrealdb
from tasks.result_fetcher import ResultBackendPoller, ResultFetcher
from workers.poller import WorkerPoller

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_):
    logger.info("Welcome to Celery Insights!")
    settings = get_settings()

    # Update timezone
    os.environ["TZ"] = settings.timezone
    time.tzset()

    # 1. Initialize SurrealDB connection
    await init_surrealdb(settings)

    celery_app = None
    event_receiver = None
    ingester = None
    worker_poller = None

    result_backend_poller = None

    if not settings.debug_snapshot_mode:
        # 2. Connect to Celery broker
        celery_app = await get_celery_app()

        # 3. Start services: EventReceiver -> SurrealDBIngester -> WorkerPoller
        result_fetcher = ResultFetcher(celery_app)
        result_backend_poller = ResultBackendPoller(
            celery_app, search_indexing_enabled=settings.search_indexing_enabled
        )

        event_receiver = CeleryEventReceiver(celery_app, asyncio.get_running_loop())
        event_receiver.start()

        ingester = SurrealDBIngester(
            queue=event_receiver.queue,
            batch_interval_ms=settings.ingestion_batch_interval_ms,
            on_terminal=result_fetcher.fetch_and_store,
            search_indexing_enabled=settings.search_indexing_enabled,
        )
        ingester.start()

        worker_poller = WorkerPoller(celery_app)
        worker_poller.start()
        result_backend_poller.start()
    else:
        logger.info("Debug snapshot mode enabled; Celery ingestion disabled")

    # Expose ingestion status to the private bridge
    _.state.settings = settings
    _.state.ingester = ingester
    _.state.debug_snapshot_mode = settings.debug_snapshot_mode

    try:
        yield
    except KeyboardInterrupt, SystemExit, CancelledError:
        logger.info("Stopping server...")
    finally:
        # Shutdown in reverse order — await async tasks before closing DB
        if result_backend_poller is not None:
            await result_backend_poller.stop()
        if worker_poller is not None:
            await worker_poller.stop()
        if ingester is not None:
            await ingester.stop()
        if event_receiver is not None:
            event_receiver.stop()
        await close_surrealdb()
        logger.info("Goodbye! See you soon.")
