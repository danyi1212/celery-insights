from pydantic import BaseModel

from tasks.model import Task
from workers.models import Worker


class SearchResults(BaseModel):
    workers: list[Worker]
    tasks: list[Task]
