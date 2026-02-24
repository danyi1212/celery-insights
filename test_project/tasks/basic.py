import logging
import random
import time

from celery_app import app

logger = logging.getLogger(__name__)


@app.task()
def noop():
    """A task that does nothing — useful for measuring overhead."""
    logger.info("noop executed")


@app.task()
def sleep_task(seconds: float = 2.0):
    """Sleep for a given number of seconds."""
    logger.info(f"Sleeping for {seconds}s")
    time.sleep(seconds)


@app.task()
def add(x: int, y: int) -> int:
    """Add two numbers and return the result."""
    result = x + y
    logger.info(f"add({x}, {y}) = {result}")
    return result


@app.task()
def random_sleep(min_seconds: float = 0.5, max_seconds: float = 5.0):
    """Sleep for a random duration within the given range."""
    duration = random.uniform(min_seconds, max_seconds)
    logger.info(f"Sleeping for {duration:.2f}s")
    time.sleep(duration)


@app.task(queue="secondary")
def secondary_queue_task():
    """A task that runs on the secondary queue."""
    duration = random.uniform(0.5, 2.0)
    logger.info(f"Secondary queue task running for {duration:.2f}s")
    time.sleep(duration)
    return "completed on secondary queue"
