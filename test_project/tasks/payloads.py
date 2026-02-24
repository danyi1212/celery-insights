import logging

from celery_app import app

logger = logging.getLogger(__name__)


@app.task()
def dict_result() -> dict:
    """Returns a dictionary result."""
    result = {"status": "ok", "items": [1, 2, 3], "metadata": {"version": "1.0", "source": "test"}}
    logger.info(f"dict_result: {result}")
    return result


@app.task()
def list_result() -> list:
    """Returns a list result."""
    result = list(range(1, 11))
    logger.info(f"list_result: {result}")
    return result


@app.task()
def string_result() -> str:
    """Returns a plain string result."""
    result = "Hello from celery-insights test harness!"
    logger.info(f"string_result: {result}")
    return result


@app.task()
def none_result() -> None:
    """Returns None (no result)."""
    logger.info("none_result: returning None")
    return None


@app.task()
def large_args(data: str) -> int:
    """Accepts a large string argument and returns its length."""
    length = len(data)
    logger.info(f"large_args: received {length} bytes")
    return length


@app.task()
def large_result(size: int = 10000) -> str:
    """Returns a large string result of the given size."""
    result = "x" * size
    logger.info(f"large_result: returning {size} bytes")
    return result


@app.task()
def numeric_result() -> float:
    """Returns a numeric (float) result."""
    result = 3.14159265358979
    logger.info(f"numeric_result: {result}")
    return result
