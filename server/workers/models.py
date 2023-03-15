from datetime import datetime
from typing import Any, Self

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


class Broker(BaseModel):
    connection_timeout: int | None = Field(description="How many seconds before failing to connect to broker")
    heartbeat: int = Field(description="Heartbeat interval in seconds")
    hostname: str = Field(description="Node name of remote broker")
    login_method: str = Field(description="Login method used to connect to the broker")
    port: int = Field(description="Broker port")
    ssl: bool = Field(description="Whether to use ssl connections")
    transport: str = Field(description="Name of transport used (e.g, amqp / redis)")
    transport_options: dict = Field(description="Additional options used to connect to broker")
    uri_prefix: str | None = Field(description="Prefix to be added to broker uri")
    userid: str = Field(description="User ID used to connect to the broker with")
    virtual_host: str = Field(description="Virtual host used")


class Pool(BaseModel):
    max_concurrency: int = Field(description="Maximum number of child parallelism (processes/threads)",
                                 alias="max-concurrency")
    max_tasks_per_child: int | str = Field(description="Maximum number of tasks to be executed before child recycled",
                                           alias="max-tasks-per-child")
    processes: list[int] = Field(description="Child process IDs (or thread IDs)")
    timeouts: tuple[int, int] = Field(description="Soft time limit and hard time limit, in seconds")


class Stats(BaseModel):
    broker: Broker = Field(description="Current broker stats")
    clock: int = Field(description="Current logical clock time")
    uptime: int = Field(description="Uptime in seconds")
    pid: int = Field(description="Process ID of worker instance (Main process)")
    pool: Pool = Field(description="Current pool stats")
    prefetch_count: int = Field(description="Current prefetch task queue for consumer")
    rusage: dict[str, Any] = Field(description="Operating System statistics")
    total: dict[str, int] = Field(description="Count of accepted tasks by type")
