import logging.config

import platform

from fastapi import FastAPI, Request
from fastapi.routing import APIRoute

from lifespan import lifespan

logger = logging.getLogger(__name__)


def custom_generate_unique_id(route: APIRoute) -> str:
    return route.name


app = FastAPI(
    title="Celery Insights",
    description="Modern Real-Time Monitoring for Celery",
    debug=False,
    lifespan=lifespan,
    generate_unique_id_function=custom_generate_unique_id,
    version="v0.2.0",
    openapi_url=None,
    docs_url=None,
    redoc_url=None,
)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.get("/bridge/status")
async def bridge_status(request: Request):
    ingester = getattr(request.app.state, "ingester", None)
    return {
        "python_version": platform.python_version(),
        "ingestion": {
            "queue_size": ingester.queue.qsize() if ingester else 0,
            "buffer_size": len(ingester._buffer) if ingester else 0,
            "dropped_events": ingester._dropped_count if ingester else 0,
            "events_ingested_total": ingester._stats_events_total if ingester else 0,
            "flushes_total": ingester._stats_flushes_total if ingester else 0,
        },
    }
