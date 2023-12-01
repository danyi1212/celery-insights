from polyfactory.factories.pydantic_factory import ModelFactory

from server_info.models import ClientDebugInfo, ServerInfo, StateDump
from tasks.factories import TaskFactory
from workers.factories import WorkerFactory
from workers.models import CPULoad


class ServerInfoFactory(ModelFactory[ServerInfo]):
    __model__ = ServerInfo
    cpu_usage = CPULoad(0, 0, 0)


class ClientDebugInfoFactory(ModelFactory[ClientDebugInfo]):
    __model__ = ClientDebugInfo


class StateDumpFactory(ModelFactory[StateDump]):
    __model__ = StateDump
    tasks = list[TaskFactory]
    workers = list[WorkerFactory]
