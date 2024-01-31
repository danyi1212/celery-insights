import logging

from fastapi import APIRouter
from starlette.websockets import WebSocket, WebSocketDisconnect, WebSocketState

from ws.managers import events_manager, raw_events_manager
from ws.websocket_manager import WebsocketManager

logger = logging.getLogger(__name__)
ws_router = APIRouter(prefix="/ws", tags=["websockets"])


async def connect_to_manager(websocket: WebSocket, manager: WebsocketManager) -> None:
    await websocket.accept()
    manager.subscribe(websocket)
    while websocket.client_state is WebSocketState.CONNECTED:
        try:
            msg = await websocket.receive_text()
            logger.warning(f"Client {websocket.client!r} sent message to {manager.name!r} manager: {msg}")
        except WebSocketDisconnect:
            manager.unsubscribe(websocket)


@ws_router.websocket("/events")
async def subscribe_events(websocket: WebSocket):
    await connect_to_manager(websocket, events_manager)


@ws_router.websocket("/raw_events")
async def subscribe_raw_events(websocket: WebSocket):
    await connect_to_manager(websocket, raw_events_manager)
