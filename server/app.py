import logging.config
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from starlette.websockets import WebSocket, WebSocketDisconnect, WebSocketState

from events.connection_manager import ws_manager
from events.router import events_router
from lifespan import lifespan
from logging_config import LoggingConfig
from settings import settings
from tasks.router import tasks_router
from workers.router import workers_router

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


@app.websocket("/ws/events")
async def subscribe_events(websocket: WebSocket):
    client_id = uuid4()
    await websocket.accept()
    logger.info(f"Subscriber {client_id} joined")
    ws_manager.subscribe(websocket)
    while websocket.client_state is WebSocketState.CONNECTED:
        try:
            msg = await websocket.receive_text()
            logger.warning(f"Subscriber {client_id} sent: {msg}")
        except WebSocketDisconnect:
            ws_manager.unsubscribe(websocket)
            logger.info(f"Subscriber {client_id} left")
