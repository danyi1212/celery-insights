import logging
import random
import time

from celery import Task
from celery.exceptions import Reject

from celery_app import app

logger = logging.getLogger(__name__)


@app.task()
def always_fails():
    """A task that always raises an exception."""
    logger.info("About to fail intentionally")
    raise RuntimeError("This task always fails")


@app.task()
def random_failure(failure_rate: float = 0.5):
    """A task that fails randomly based on the given rate (0.0-1.0)."""
    time.sleep(random.uniform(0.2, 1.0))
    if random.random() < failure_rate:
        logger.warning("Random failure triggered")
        raise RuntimeError(f"Random failure (rate={failure_rate})")
    logger.info("Random failure task succeeded")
    return "survived"


@app.task(bind=True, max_retries=3)
def retry_with_backoff(self: Task):
    """A task that always fails but retries with exponential backoff."""
    logger.info(f"retry_with_backoff attempt {self.request.retries + 1}/{self.max_retries + 1}")
    try:
        raise ConnectionError("Simulated connection error")
    except ConnectionError as exc:
        raise self.retry(exc=exc, countdown=2**self.request.retries) from exc


@app.task(bind=True, max_retries=2)
def retry_manual(self: Task):
    """A task that retries manually with a fixed countdown."""
    logger.info(f"retry_manual attempt {self.request.retries + 1}/{self.max_retries + 1}")
    try:
        raise TimeoutError("Simulated timeout")
    except TimeoutError as exc:
        raise self.retry(exc=exc, countdown=3) from exc


@app.task()
def division_by_zero():
    """A task that triggers a ZeroDivisionError."""
    logger.info("About to divide by zero")
    return 1 / 0


@app.task()
def deep_traceback(depth: int = 5):
    """A task that generates a deep call stack before failing."""

    def recurse(n: int):
        if n <= 0:
            raise ValueError(f"Reached bottom of {depth}-deep call stack")
        return recurse(n - 1)

    logger.info(f"Starting deep traceback with depth={depth}")
    return recurse(depth)


@app.task()
def reject_task():
    """A task that rejects itself (message is requeued by default)."""
    logger.warning("Rejecting task")
    raise Reject("Task rejected intentionally", requeue=False)
