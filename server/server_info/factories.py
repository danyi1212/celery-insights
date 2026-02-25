from typing import ClassVar

from polyfactory.factories.pydantic_factory import ModelFactory

from server_info.models import ClientDebugInfo, ServerInfo, StateDump
from workers.models import CPULoad


class ServerInfoFactory(ModelFactory[ServerInfo]):
    __model__ = ServerInfo
    cpu_usage = CPULoad(0, 0, 0)


class ClientDebugInfoFactory(ModelFactory[ClientDebugInfo]):
    __model__ = ClientDebugInfo


class StateDumpFactory(ModelFactory[StateDump]):
    __model__ = StateDump
    tasks: ClassVar[list[dict]] = [{"id": "task:test-1", "state": "SUCCESS", "type": "app.add"}]
    workers: ClassVar[list[dict]] = [{"id": "worker:test-1", "status": "online"}]
