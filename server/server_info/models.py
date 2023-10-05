import logging
import os
import platform
import resource
import time
from typing import Self

import user_agents
from celery.events.state import State
from pydantic import BaseModel, Field
from starlette.requests import Request
from starlette.websockets import WebSocket, WebSocketState
from user_agents.parsers import UserAgent

logger = logging.getLogger(__name__)
start_time = time.perf_counter()


class ServerInfo(BaseModel):
    cpu_usage: tuple[float, float, float] = Field(desciption="CPU load average in last 1, 5 and 15 minutes")
    memory_usage: float = Field(description="Memory Usage in KB")
    uptime: float = Field(description="Server Uptime in seconds")
    server_hostname: str = Field(description="Server Hostname")
    server_port: int = Field(description="Server Port")
    server_version: str = Field(description="Server Version")
    server_os: str = Field(description="Server OS")
    server_name: str = Field(description="Server Device Name")
    python_version: str = Field(description="Python Version")
    task_count: int = Field(description="Number of tasks stored in state")
    tasks_max_count: int = Field(description="Maximum number of tasks to store in state")
    worker_count: int = Field(description="Number of workers running")
    worker_max_count: int = Field(description="Maximum number of workers to store in state")

    @classmethod
    def create(cls, request: Request, state: State) -> Self:
        rusage = resource.getrusage(resource.RUSAGE_SELF)
        return ServerInfo(
            cpu_usage=os.getloadavg(),
            memory_usage=rusage.ru_maxrss,
            uptime=time.perf_counter() - start_time,
            server_hostname=request.url.hostname,
            server_port=request.url.port,
            server_version=request.app.version,
            server_os=platform.system(),
            server_name=platform.node(),
            python_version=platform.python_version(),
            task_count=state.task_count,
            tasks_max_count=state.max_tasks_in_memory,
            worker_count=len(state.workers),
            worker_max_count=state.max_workers_in_memory,
        )


class ClientInfo(BaseModel):
    host: str = Field(description="Client Hostname")
    port: int = Field(description="Client Port")
    state: WebSocketState = Field(description="Connection State")
    is_secure: bool = Field(description="Connection Secure Scheme WSS")
    os: str | None = Field(None, description="Operating System Name")
    os_version: str | None = Field(None, description="Operating System Version")
    device_family: str | None = Field(None, description="Device Family")
    device_brand: str | None = Field(None, description="Device Brand")
    device_model: str | None = Field(None, description="Device Model")
    browser: str | None = Field(None, description="Browser Name")
    browser_version: str | None = Field(None, description="Browser Version")

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
