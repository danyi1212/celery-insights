import logging.config
from fastapi import FastAPI
from fastapi.routing import APIRoute
from pathlib import Path
from starlette.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from starlette.websockets import WebSocket, WebSocketDisconnect, WebSocketState
from uuid import uuid4

from api import api_router
from events.connection_manager import ws_manager
from lifespan import lifespan
from logging_config import LoggingConfig
from settings import settings

logging.config.dictConfig(LoggingConfig().dict())
logger = logging.getLogger(__name__)
logger.info("Welcome!")


def custom_generate_unique_id(route: APIRoute) -> str:
    return route.name


app = FastAPI(
    title="Celery Soup",
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

app.include_router(api_router)


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
