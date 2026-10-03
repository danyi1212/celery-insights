"""Leader-owned background services, independent of the always-on HTTP API."""

import asyncio
import logging.config
import signal
from types import SimpleNamespace
from contextlib import suppress

from lifespan import lifespan
from logging_config import LOGGING_CONFIG
from runtime_state import apply_retention, publish_ingestion_stats


async def main():
    stopped = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stopped.set)
    app = SimpleNamespace(state=SimpleNamespace())
    async with lifespan(app):
        while not stopped.is_set():
            try:
                await apply_retention(app.state.cleanup_job)
                if app.state.ingester is not None:
                    await publish_ingestion_stats(app.state.ingester)
            except Exception:
                logging.getLogger(__name__).exception("Failed to synchronize leader runtime state")
            with suppress(TimeoutError):
                await asyncio.wait_for(stopped.wait(), timeout=1)


if __name__ == "__main__":
    logging.config.dictConfig(LOGGING_CONFIG)
    asyncio.run(main())
