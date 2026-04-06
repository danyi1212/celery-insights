import logging.config

from fastapi import FastAPI
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware

from exports.router import exports_router
from lifespan import lifespan
from metrics.router import metrics_router
from server_info.router import settings_router
from settings import Settings

logger = logging.getLogger(__name__)


def custom_generate_unique_id(route: APIRoute) -> str:
    return route.name


app = FastAPI(
    title="Celery Insights",
    description="Modern Real-Time Monitoring for Celery",
    debug=Settings().debug,
    lifespan=lifespan,
    generate_unique_id_function=custom_generate_unique_id,
    version="v0.2.0",
    openapi_url=None,
    docs_url=None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,  # ty: ignore[invalid-argument-type]
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8555",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8555",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


app.include_router(settings_router)
app.include_router(metrics_router)
app.include_router(exports_router)
