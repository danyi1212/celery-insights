import asyncio
import logging
from asyncio import Queue

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebsocketManager:
    def __init__(self, name: str):
        self.name = name
        self.queue = Queue()
        self.active_connections: list[WebSocket] = []

    def subscribe(self, websocket: WebSocket) -> None:
        logger.info(f"Client {websocket.client!r} subscribed to {self.name!r} websocket manager")
        self.active_connections.append(websocket)

    def unsubscribe(self, websocket: WebSocket) -> None:
        logger.info(f"Client {websocket.client!r} unsubscribed from {self.name!r} websocket manager")
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str) -> None:
        results = await asyncio.gather(
            *[
                connection.send_text(message)
                for connection in self.active_connections
            ], return_exceptions=True
            )
        for result, connection in zip(results, self.active_connections):
            if isinstance(result, Exception):
                logger.exception(f"Failed to send message to client {connection.client!r}: {result}", exc_info=result)
