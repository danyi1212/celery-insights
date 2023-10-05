from typing import Any, Self

from celery.events.state import Worker as CeleryWorker
from pydantic import BaseModel, Extra, Field

from common.types import EpochTimestamp


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
    heartbeat_expires: EpochTimestamp | None = Field(None, description="When worker will be considered offline")
    cpu_load: tuple[float, float, float] | None = Field(None, description="Host CPU load average in last 1, 5 and 15 minutes")

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
            cpu_load=tuple(worker.loadavg) if worker.loadavg is not None else None,
        )


class Broker(BaseModel, extra=Extra.allow):
    connection_timeout: int | None = Field(None, description="How many seconds before failing to connect to broker")
    heartbeat: int = Field(description="Heartbeat interval in seconds")
    hostname: str = Field(description="Node name of remote broker")
    login_method: str = Field(description="Login method used to connect to the broker")
    port: int = Field(description="Broker port")
    ssl: bool = Field(description="Whether to use ssl connections")
    transport: str = Field(description="Name of transport used (e.g, amqp / redis)")
    transport_options: dict = Field(description="Additional options used to connect to broker")
    uri_prefix: str | None = Field(None, description="Prefix to be added to broker uri")
    userid: str = Field(description="User ID used to connect to the broker with")
    virtual_host: str = Field(description="Virtual host used")


class Pool(BaseModel, extra=Extra.allow):
    max_concurrency: int = Field(
        description="Maximum number of child parallelism (processes/threads)",
        alias="max-concurrency"
    )
    max_tasks_per_child: int | str = Field(
        description="Maximum number of tasks to be executed before child recycled",
        alias="max-tasks-per-child"
    )
    processes: list[int] = Field(description="Child process IDs (or thread IDs)")
    timeouts: tuple[int, int] = Field(description="Soft time limit and hard time limit, in seconds")


class Stats(BaseModel, extra=Extra.allow):
    broker: Broker = Field(description="Current broker stats")
    clock: int = Field(description="Current logical clock time")
    uptime: int = Field(description="Uptime in seconds")
    pid: int = Field(description="Process ID of worker instance (Main process)")
    pool: Pool = Field(description="Current pool stats")
    prefetch_count: int = Field(description="Current prefetch task queue for consumer")
    rusage: dict[str, Any] = Field(description="Operating System statistics")
    total: dict[str, int] = Field(description="Count of accepted tasks by type")


class ExchangeInfo(BaseModel, extra=Extra.allow):
    name: str = Field(description="Name of exchange")
    type: str = Field(description="Exchange routing type")


class QueueInfo(BaseModel, extra=Extra.allow):
    name: str = Field(description="Name of the queue")
    exchange: ExchangeInfo = Field(description="Exchange information")
    routing_key: str = Field(description="Routing key for the queue")
    queue_arguments: dict[str, Any] | None = Field(None, description="Arguments for the queue")
    binding_arguments: dict[str, Any] | None = Field(None, description="Arguments for bindings")
    consumer_arguments: dict[str, Any] | None = Field(None, description="Arguments for consumers")
    durable: bool = Field(description="Queue will survive broker restart")
    exclusive: bool = Field(description="Queue can be used by only one consumer")
    auto_delete: bool = Field(description="Queue will be deleted after last consumer unsubscribes")
    no_ack: bool = Field(description="Workers will not acknowledge task messages")
    alias: str | None = Field(None, description="Queue alias if used for queue names")
    message_ttl: int | None = Field(None, description="Message TTL in seconds")
    max_length: int | None = Field(None, description="Maximum number of task messages allowed in the queue")
    max_priority: int | None = Field(None, description="Maximum priority for task messages in the queue")


class DeliveryInfo(BaseModel, extra=Extra.allow):
    exchange: str = Field(description="Broker exchange used")
    priority: int | None = Field(None, description="Message priority")
    redelivered: bool = Field(description="Message sent back to queue")
    routing_key: str = Field(description="Message routing key used")


class TaskRequest(BaseModel, extra=Extra.allow):
    id: str = Field(description="Task unique id")
    name: str = Field(description="Task name")
    type: str = Field(description="Task type")
    args: list[Any] = Field(description="Task positional arguments")
    kwargs: dict[str, Any] = Field(description="Task keyword arguments")
    delivery_info: DeliveryInfo = Field(description="Delivery Information about the task Message")
    acknowledged: bool = Field(description="Whether the task message is acknowledged")
    time_start: EpochTimestamp | None = Field(None, description="When the task has started by the worker")
    hostname: str = Field(description="Worker hostname")
    worker_pid: int | None = Field(None, description="Child worker process ID")


class ScheduledTask(BaseModel, extra=Extra.allow):
    eta: str = Field(description="Absolute time when the task should be executed")
    priority: int = Field(description="Message priority")
    request: TaskRequest = Field(description="Task Information")
