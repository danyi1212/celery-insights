from polyfactory.factories.pydantic_factory import ModelFactory

from events.models import EventMessage
from tasks.factories import TaskFactory


class EventMessageFactory(ModelFactory[EventMessage]):
    __model__ = EventMessage
    data = TaskFactory
