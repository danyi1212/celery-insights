import logging
from typing import Self

import user_agents
from pydantic import BaseModel
from starlette.websockets import WebSocket, WebSocketState
from user_agents.parsers import UserAgent

logger = logging.getLogger(__name__)


class ClientInfo(BaseModel):
    host: str
    port: int
    state: WebSocketState
    is_secure: bool
    os: str | None
    os_version: str | None
    device_family: str | None
    device_brand: str | None
    device_model: str | None
    browser: str | None
    browser_version: str | None

    @classmethod
    def from_websocket(cls, websocket: WebSocket) -> Self:
        user_agent = cls.get_user_agent(websocket)
        return cls(
            host=websocket.client.host,
            port=websocket.client.port,
            state=websocket.client_state,
            is_secure=websocket.url.is_secure,
            os=user_agent.os.family if user_agent is not None else None,
            os_version=user_agent.os.version_string if user_agent is not None else None,
            device_family=user_agent.device.family if user_agent is not None else None,
            device_model=user_agent.device.model if user_agent is not None else None,
            device_brand=user_agent.device.brand if user_agent is not None else None,
            browser=user_agent.browser.family if user_agent is not None else None,
            browser_version=user_agent.browser.version_string if user_agent is not None else None,
        )

    @classmethod
    def get_user_agent(cls, websocket: WebSocket) -> UserAgent | None:
        user_agent_string = websocket.headers.get("User-Agent")
        if user_agent_string is not None:
            try:
                return user_agents.parse(user_agent_string)
            except Exception as e:
                logger.exception(f"Error parsing user-agent string {user_agent_string!r}: {e}")
