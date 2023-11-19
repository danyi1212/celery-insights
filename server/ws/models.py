import logging
from typing import Self

import user_agents
from pydantic import BaseModel, Field
from starlette.websockets import WebSocket, WebSocketState

logger = logging.getLogger(__name__)


class UserAgentInfo(BaseModel):
    os: str | None = Field(None, description="Operating System Name")
    os_version: str | None = Field(None, description="Operating System Version")
    device_family: str | None = Field(None, description="Device Family")
    device_brand: str | None = Field(None, description="Device Brand")
    device_model: str | None = Field(None, description="Device Model")
    browser: str | None = Field(None, description="Browser Name")
    browser_version: str | None = Field(None, description="Browser Version")

    @classmethod
    def parse(cls, user_agent_string: str) -> Self:
        user_agent = user_agents.parse(user_agent_string)
        return cls(
            os=user_agent.os.family if user_agent is not None else None,
            os_version=user_agent.os.version_string if user_agent is not None else None,
            device_family=user_agent.device.family if user_agent is not None else None,
            device_model=user_agent.device.model if user_agent is not None else None,
            device_brand=user_agent.device.brand if user_agent is not None else None,
            browser=user_agent.browser.family if user_agent is not None else None,
            browser_version=user_agent.browser.version_string if user_agent is not None else None,
        )


class ClientInfo(BaseModel):
    host: str = Field(description="Client Hostname")
    port: int = Field(description="Client Port")
    state: WebSocketState = Field(description="Connection State")
    is_secure: bool = Field(description="Connection Secure Scheme WSS")
    user_agent: UserAgentInfo | None = Field(None, description="User agent details")

    @classmethod
    def from_websocket(cls, websocket: WebSocket) -> Self:
        user_agent = cls.get_user_agent(websocket)
        return cls(
            host=websocket.client.host,
            port=websocket.client.port,
            state=websocket.client_state,
            is_secure=websocket.url.is_secure,
            user_agent=user_agent,
        )

    @classmethod
    def get_user_agent(cls, websocket: WebSocket) -> UserAgentInfo | None:
        user_agent_string = websocket.headers.get("User-Agent")
        if user_agent_string is None:
            return

        try:
            return UserAgentInfo.parse(user_agent_string)
        except Exception as e:
            logger.exception(f"Error parsing user-agent string {user_agent_string!r}: {e}")
