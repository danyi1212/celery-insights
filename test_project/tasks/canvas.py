import logging
import random
import time

from celery_app import app

logger = logging.getLogger(__name__)


@app.task()
def step(value: int, name: str) -> int:
    """A generic pipeline step that increments a value. Used in chains and chords."""
    duration = random.uniform(0.3, 1.5)
    time.sleep(duration)
    result = value + 1
    logger.info(f"step({name}) {value} -> {result} ({duration:.2f}s)")
    return result


@app.task()
def accumulate(results: list) -> int:
    """Chord callback that sums results from a group of tasks."""
    total = sum(results)
    logger.info(f"accumulate({results}) = {total}")
    return total


@app.task()
def on_success(result):
    """Link callback: runs when the parent task succeeds."""
    logger.info(f"on_success called with result: {result}")
    return f"success_handled: {result}"


@app.task()
def on_error(request, exc, _traceback):
    """Link error callback: runs when the parent task fails."""
    logger.error(f"on_error called for task {request.id}: {exc}")
    return f"error_handled: {exc}"


@app.task()
def order_workflow():
    """Simulates an order processing workflow with nested apply_async calls."""
    time.sleep(random.uniform(0.5, 2.0))
    logger.info("Order workflow started")
    update_inventory.apply_async()
    create_invoice.apply_async()


@app.task()
def create_invoice():
    """Creates an invoice as part of the order workflow."""
    time.sleep(random.uniform(0.5, 2.0))
    logger.info("Invoice created")


@app.task()
def update_inventory():
    """Updates inventory and schedules shipment creation."""
    time.sleep(random.uniform(0.5, 2.0))
    logger.info("Inventory updated")
    create_shipment.apply_async(countdown=5)


@app.task()
def create_shipment():
    """Creates a shipment and triggers downstream tasks."""
    time.sleep(random.uniform(0.5, 2.0))
    logger.info("Shipment created")
    generate_sales_report.apply_async()
    notify_user.apply_async()


@app.task()
def generate_sales_report():
    """Generates a sales report."""
    time.sleep(random.uniform(0.5, 2.0))
    logger.info("Sales report generated")


@app.task()
def notify_user():
    """Sends a user notification."""
    time.sleep(random.uniform(0.5, 1.5))
    logger.info("User notified")
