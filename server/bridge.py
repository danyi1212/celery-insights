"""Private Celery process transport; application identity and policy live in Bun."""

import hmac

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from settings import get_settings


class BridgeCallerGate:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] == "lifespan":
            await self.app(scope, receive, send)
            return
        if scope["type"] == "websocket":
            await send({"type": "websocket.close", "code": 1008})
            return
        expected = get_settings().bridge_token
        values = [value for name, value in scope.get("headers", []) if name == b"x-celery-bridge-token"]
        if not expected or len(values) != 1 or not hmac.compare_digest(values[0], expected.encode("ascii")):
            await JSONResponse({"detail": "Private bridge caller required"}, status_code=403)(scope, receive, send)
            return
        await self.app(scope, receive, send)
