import logging

from fastapi import APIRouter
from starlette.websockets import WebSocket, WebSocketDisconnect, WebSocketState

from ws.managers import events_manager

logger = logging.getLogger(__name__)
ws_router = APIRouter(prefix="/ws", tags=["websockets"])


@ws_router.websocket("/events")
async def subscribe_events(websocket: WebSocket):
    await websocket.accept()
    events_manager.subscribe(websocket)
    while websocket.client_state is WebSocketState.CONNECTED:
        try:
            msg = await websocket.receive_text()
            logger.warning(f"Client {websocket.client!r} sent to events ws: {msg}")
        except WebSocketDisconnect:
            events_manager.unsubscribe(websocket)
