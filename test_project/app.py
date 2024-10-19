import logging.config
import random
import time

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


@app.task()
def order_workflow() -> None:
    time.sleep(random.randrange(1, 5))
    update_inventory.apply_async()
    create_invoice.apply_async()


@app.task()
def create_invoice() -> None:
    time.sleep(random.randrange(1, 5))


@app.task()
def update_inventory() -> None:
    time.sleep(random.randrange(1, 5))
    create_shipment.apply_async(countdown=10)


@app.task()
def create_shipment() -> None:
    time.sleep(random.randrange(1, 5))
    generate_sales_report.apply_async()
    notify_user.apply_async()


@app.task()
def generate_sales_report() -> None:
    time.sleep(random.randrange(1, 5))


@app.task()
def notify_user() -> None:
    time.sleep(random.randrange(1, 5))
