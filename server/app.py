import logging.config
from pathlib import Path

from fastapi import FastAPI
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles

from events.router import events_router
from lifespan import lifespan
from logging_config import LoggingConfig
from settings import settings
from tasks.router import tasks_router
from workers.router import workers_router
from ws.router import ws_router

logging.config.dictConfig(LoggingConfig().dict())
logger = logging.getLogger(__name__)
logger.info("Welcome!")


def custom_generate_unique_id(route: APIRoute) -> str:
    return route.name


app = FastAPI(
    title="Celery Insights",
    description="Modern Real-Time Monitoring for Celery",
    debug=settings.debug,
    lifespan=lifespan,
    generate_unique_id_function=custom_generate_unique_id,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:8555",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8555",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

if Path("static").exists():
    app.mount("/", StaticFiles(directory="static", html=True), name="static")

app.include_router(tasks_router)
app.include_router(workers_router)
app.include_router(events_router)
app.include_router(ws_router)
