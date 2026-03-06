import logging

from fastapi import APIRouter, Request
from starlette.responses import Response

from metrics.collectors import collect_tier1, collect_tier2, collect_tier3

logger = logging.getLogger(__name__)

CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8"

metrics_router = APIRouter(tags=["metrics"])


@metrics_router.get("/metrics")
async def get_metrics() -> Response:
    output = await collect_tier1()
    return Response(content=output, media_type=CONTENT_TYPE)


@metrics_router.get("/metrics/verbose")
async def get_metrics_verbose() -> Response:
    output = await collect_tier2()
    return Response(content=output, media_type=CONTENT_TYPE)


@metrics_router.get("/metrics/system")
async def get_metrics_system(request: Request) -> Response:
    ingester = getattr(request.app.state, "ingester", None)
    output = await collect_tier3(ingester)
    return Response(content=output, media_type=CONTENT_TYPE)
