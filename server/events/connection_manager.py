import asyncio
from asyncio import Queue

from starlette.websockets import WebSocket


class ConnectionManager:
    def __init__(self):
        self.queue = Queue()
        self.active_connections: list[WebSocket] = []

    def subscribe(self, websocket: WebSocket) -> None:
        self.active_connections.append(websocket)

    def unsubscribe(self, websocket: WebSocket) -> None:
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str) -> None:
        await asyncio.gather(*[
            connection.send_text(message)
            for connection in self.active_connections
        ], return_exceptions=True)


ws_manager = ConnectionManager()
