import logging
import random
import time
from datetime import UTC, datetime, timedelta

from celery import chain

from celery_app import app
from tasks.basic import add

logger = logging.getLogger(__name__)


@app.task(bind=True)
def replace_with_chain(self):
    """A task that replaces itself with a chain of add tasks."""
    logger.info("Replacing self with a chain of add tasks")
    return self.replace(chain(add.s(1, 2), add.s(3), add.s(4)))


@app.task()
def long_running(duration: float = 15.0):
    """A task that runs for a long time — useful for testing revocation."""
    logger.info(f"Long running task started, will run for {duration}s")
    start = time.monotonic()
    while time.monotonic() - start < duration:
        time.sleep(1.0)
    logger.info("Long running task completed")
    return f"ran for {duration}s"


@app.task()
def eta_task():
    """A task that schedules itself to run 30 seconds in the future using ETA."""
    eta = datetime.now(UTC) + timedelta(seconds=30)
    logger.info(f"Scheduling eta_task_worker for {eta.isoformat()}")
    eta_task_worker.apply_async(eta=eta)


@app.task()
def eta_task_worker():
    """The actual worker for eta_task — runs after the ETA delay."""
    logger.info("ETA task worker executed")
    return "eta task completed"


@app.task()
def countdown_task():
    """A task that schedules a follow-up task with a 15-second countdown."""
    logger.info("Scheduling countdown follow-up in 15s")
    countdown_task_worker.apply_async(countdown=15)


@app.task()
def countdown_task_worker():
    """The actual worker for countdown_task — runs after the countdown."""
    duration = random.uniform(0.5, 2.0)
    time.sleep(duration)
    logger.info("Countdown task worker executed")
    return "countdown task completed"
