import asyncio
from asyncio import Queue, Task

from starlette.websockets import WebSocket


class ConnectionManager:
    def __init__(self):
        self.queue = Queue()
        self.listener: Task | None = None
        self.active_connections: list[WebSocket] = []

    def subscribe(self, websocket: WebSocket) -> None:
        self.active_connections.append(websocket)

    def unsubscribe(self, websocket: WebSocket) -> None:
        self.active_connections.remove(websocket)

    async def broadcast(self, event: dict) -> None:
        await asyncio.gather(*[
            connection.send_json(event)
            for connection in self.active_connections
        ])


ws_manager = ConnectionManager()
