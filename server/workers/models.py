from datetime import datetime
from typing import Self

from celery.events.state import Worker as CeleryWorker
from pydantic import BaseModel, Field

from tasks.utils import timestamp_to_datetime


class Worker(BaseModel):
    id: str = Field(description="Worker unique name comprised of hostname and pid")
    hostname: str = Field(description=f"Worker hostname")
    pid: int = Field(description="Worker OS Process ID")
    software_identity: str = Field(description="Name of worker software (e.g, py-celery)")
    software_version: str = Field(description="Software version")
    software_sys: str = Field(description="Software Operating System name (e.g, Linux/Darwin)")
    active_tasks: int = Field(description="Amount of tasks currently processing by worker")
    processed_tasks: int = Field(description="Amount of tasks completed by worker")
    last_updated: datetime = Field(description="When worker last event published")
    heartbeat_expires: datetime = Field(description="When worker will be considered offline")
    cpu_load: tuple[float, float, float] | None = Field(description="Host CPU load average in last 1, 5 and 15 minutes")

    @classmethod
    def from_celery_worker(cls, worker: CeleryWorker) -> Self:
        return cls(
            id=worker.id,
            hostname=worker.hostname,
            pid=worker.pid,
            last_updated=timestamp_to_datetime(worker.timestamp),
            software_identity=worker.sw_ident,
            software_version=worker.sw_ver,
            software_sys=worker.sw_sys,
            active_tasks=worker.active or 0,
            processed_tasks=worker.processed or 0,
            heartbeat_expires=timestamp_to_datetime(worker.heartbeat_expires),
            cpu_load=tuple(worker.loadavg) if worker.loadavg is not None else None,
        )
