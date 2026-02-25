import logging.config

from celery import Celery

from logging_config import LOGGING_CONFIG
from settings import Settings

logging.config.dictConfig(LOGGING_CONFIG)

settings = Settings()
app = Celery(
    "tests",
    broker=settings.broker_url,
    backend=settings.result_backend,
)
app.conf.broker_connection_retry_on_startup = True
app.conf.worker_send_task_events = True
app.conf.task_send_sent_event = True
app.conf.task_track_started = True
app.conf.result_extended = True
app.conf.enable_utc = True
app.conf.task_reject_on_worker_lost = True
app.conf.task_acks_late = True

app.autodiscover_tasks(["tasks.basic", "tasks.canvas", "tasks.failures", "tasks.lifecycle", "tasks.payloads"])
