from typing import Self

from celery.events.state import Worker as CeleryWorker
from pydantic import BaseModel


class Worker(BaseModel):
    name: str

    @classmethod
    def from_celery_worker(cls, worker: CeleryWorker) -> Self:
        return cls(
            name=worker.hostname,
        )
