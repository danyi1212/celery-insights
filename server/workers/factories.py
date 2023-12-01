from polyfactory.factories.pydantic_factory import ModelFactory

from workers.models import CPULoad, Worker


class WorkerFactory(ModelFactory[Worker]):
    __model__ = Worker
    cpu_load = CPULoad(0, 0, 0)
