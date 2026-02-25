from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

from surrealdb import AsyncSurreal

from settings import Settings

if TYPE_CHECKING:
    from surrealdb.connections.async_template import AsyncTemplate

logger = logging.getLogger(__name__)

_db: AsyncTemplate | None = None
_lock = asyncio.Lock()


async def connect_surrealdb(settings: Settings) -> AsyncTemplate:
    """Connect to SurrealDB as the ingester user. Returns the connected client."""
    db = AsyncSurreal(settings.surrealdb_url)
    await db.signin({"username": "ingester", "password": settings.surrealdb_ingester_pass})
    await db.use(settings.surrealdb_namespace, settings.surrealdb_database)
    logger.info(
        "Connected to SurrealDB at %s (ns=%s, db=%s)",
        settings.surrealdb_url,
        settings.surrealdb_namespace,
        settings.surrealdb_database,
    )
    return db


async def init_surrealdb(settings: Settings | None = None) -> AsyncTemplate:
    """Initialize the singleton SurrealDB connection with retry logic.

    On connection failure, retries with exponential backoff (1s, 2s, 4s, ... max 30s).
    """
    global _db
    async with _lock:
        if _db is not None:
            return _db

        if settings is None:
            settings = Settings()

        delay = 1.0
        max_delay = 30.0

        while True:
            try:
                _db = await connect_surrealdb(settings)
                return _db
            except (OSError, ConnectionError, RuntimeError):
                logger.warning("Failed to connect to SurrealDB, retrying in %.0fs...", delay, exc_info=True)
                await asyncio.sleep(delay)
                delay = min(delay * 2, max_delay)


def get_db() -> AsyncTemplate:
    """Get the singleton SurrealDB connection. Raises RuntimeError if not initialized."""
    if _db is None:
        raise RuntimeError("SurrealDB connection not initialized. Call init_surrealdb() first.")
    return _db


async def close_surrealdb() -> None:
    """Close the singleton SurrealDB connection."""
    global _db
    async with _lock:
        if _db is not None:
            await _db.close()
            _db = None
            logger.info("SurrealDB connection closed")
