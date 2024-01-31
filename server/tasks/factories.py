from polyfactory.factories.pydantic_factory import ModelFactory

from tasks.model import Task


class TaskFactory(ModelFactory[Task]):
    __model__ = Task
