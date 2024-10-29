from typing import Annotated, Any, NamedTuple, Self, Dict, List, Tuple

from celery.events.state import Worker as CeleryWorker
from pydantic import BaseModel, BeforeValidator, Field, ConfigDict

from common.types import EpochTimestamp


class CPULoad(NamedTuple):
    avg_1min: float
    avg_5min: float
    avg_15min: float


class Worker(BaseModel):
    id: str = Field(description="Worker unique name comprised of hostname and pid")
    hostname: str = Field(description="Worker hostname")
    pid: int = Field(description="Worker OS Process ID")
    software_identity: str = Field(description="Name of worker software (e.g, py-celery)")
    software_version: str = Field(description="Software version")
    software_sys: str = Field(description="Software Operating System name (e.g, Linux/Darwin)")
    active_tasks: int = Field(description="Number of tasks currently processed by worker")
    processed_tasks: int = Field(description="Number of tasks completed by worker")
    last_updated: EpochTimestamp = Field(description="When worker latest event published")
    heartbeat_expires: EpochTimestamp | None = Field(default=None, description="When worker will be considered offline")
    cpu_load: CPULoad | None = Field(default=None, description="Host CPU load average in last 1, 5 and 15 minutes")

    @classmethod
    def from_celery_worker(cls, worker: CeleryWorker) -> Self:
        return cls(
            id=f"{worker.hostname}-{worker.pid}",
            hostname=worker.hostname,
            pid=worker.pid,
            last_updated=worker.timestamp,
            software_identity=worker.sw_ident,
            software_version=worker.sw_ver,
            software_sys=worker.sw_sys,
            active_tasks=worker.active or 0,
            processed_tasks=worker.processed or 0,
            heartbeat_expires=worker.heartbeat_expires if worker.heartbeats else None,
            cpu_load=CPULoad(*worker.loadavg) if worker.loadavg is not None else None,
        )


def cast_int(value: Any) -> int:
    if isinstance(value, int):
        return value
    elif isinstance(value, str) and value.isdigit():
        return int(value)

    try:
        return int(value)
    except ValueError:
        return 0


CastedInt = Annotated[int, BeforeValidator(cast_int)]


class Broker(BaseModel):
    connection_timeout: int | None = Field(
        default=None, description="How many seconds before failing to connect to broker"
    )
    heartbeat: int = Field(0, description="Heartbeat interval in seconds")
    hostname: str | None = Field(default=None, description="Node name of remote broker")
    login_method: str | None = Field(default=None, description="Login method used to connect to the broker")
    port: CastedInt = Field(0, description="Broker port")
    ssl: bool = Field(default=False, description="Whether to use ssl connections")
    transport: str | None = Field(default=None, description="Name of transport used (e.g, amqp / redis)")
    transport_options: Dict[str, Any] = Field(
        default_factory=dict, description="Additional options used to connect to broker"
    )
    uri_prefix: str | None = Field(default=None, description="Prefix to be added to broker uri")
    userid: str | None = Field(default=None, description="User ID used to connect to the broker with")
    virtual_host: str | None = Field(default=None, description="Virtual host used")

    model_config = ConfigDict(
        extra="ignore",
    )


class Pool(BaseModel):
    max_concurrency: CastedInt = Field(
        0, description="Maximum number of child parallelism (processes/threads)", alias="max-concurrency"
    )
    max_tasks_per_child: CastedInt = Field(
        0, description="Maximum number of tasks to be executed before child recycled", alias="max-tasks-per-child"
    )
    processes: List[int] = Field(default_factory=list, description="Child process IDs (or thread IDs)")
    timeouts: Tuple[int, int] = Field(
        default_factory=lambda: (0, 0), description="Soft time limit and hard time limit, in seconds"
    )

    model_config = ConfigDict(
        extra="ignore",
    )


class Stats(BaseModel):
    broker: Broker = Field(default_factory=Broker, description="Current broker stats")
    clock: int = Field(description="Current logical clock time")
    uptime: int = Field(description="Uptime in seconds")
    pid: CastedInt = Field(description="Process ID of worker instance (Main process)")
    pool: Pool = Field(default_factory=Pool, description="Current pool stats")
    prefetch_count: CastedInt = Field(description="Current prefetch task queue for consumer")
    rusage: Dict[str, Any] = Field(default_factory=dict, description="Operating System statistics")
    total: Dict[str, int] = Field(default_factory=dict, description="Count of accepted tasks by type")

    model_config = ConfigDict(
        extra="ignore",
    )
