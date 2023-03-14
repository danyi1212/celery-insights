from enum import Enum
from typing import Literal

from pydantic import BaseModel

from tasks.model import Task
from workers.models import Worker


class EventType(str, Enum):
    TASK_SENT = "task-sent"
    TASK_RECEIVED = "task-received"
    TASK_STARTED = "task-started"
    TASK_SUCCEEDED = "task-succeeded"
    TASK_FAILED = "task-failed"
    TASK_REJECTED = "task-rejected"
    TASK_REVOKED = "task-revoked"
    TASK_RETRIED = "task-retried"
    WORKER_ONLINE = "worker-online"
    WORKER_HEARTBEAT = "worker-heartbeat"
    WORKER_OFFLINE = "worker-offline"


class EventCategory(str, Enum):
    TASK = "task"
    WORKER = "worker"


class TaskEventMessage(BaseModel):
    type: EventType
    category: Literal[EventCategory.TASK]
    task: Task


class WorkerEventMessage(BaseModel):
    type: EventType
    category: Literal[EventCategory.WORKER]
    worker: Worker


EventMessage = TaskEventMessage | WorkerEventMessage
