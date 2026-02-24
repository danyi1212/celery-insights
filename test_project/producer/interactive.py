import logging
import logging.config

from celery.result import AsyncResult
from fastapi import FastAPI, HTTPException

from celery_app import app as celery_app
from logging_config import LOGGING_CONFIG
from producer.scenarios import list_scenarios, run_all_scenarios, run_scenario

logging.config.dictConfig(LOGGING_CONFIG)
logger = logging.getLogger(__name__)

app = FastAPI(title="Celery Insights Test Harness", description="Interactive scenario runner for E2E testing")


@app.get("/scenarios")
def get_scenarios() -> list[str]:
    """List all available scenario names."""
    return list_scenarios()


@app.post("/scenarios/{name}")
def post_scenario(name: str) -> dict[str, str]:
    """Trigger a single scenario by name."""
    try:
        task_id = run_scenario(name)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"scenario": name, "task_id": task_id}


@app.post("/burst")
def post_burst(count: int = 10) -> dict[str, list[str]]:
    """Send a burst of random noop/add/sleep tasks for load testing."""
    from tasks.basic import add, noop, sleep_task

    task_ids = []
    import random

    tasks = [noop.si, lambda: add.s(random.randint(1, 100), random.randint(1, 100)), lambda: sleep_task.s(0.5)]
    for _ in range(count):
        sig = random.choice(tasks)()
        result = sig.apply_async()
        task_ids.append(result.id)
    logger.info(f"Burst of {count} tasks dispatched")
    return {"task_ids": task_ids}


@app.post("/all")
def post_all() -> dict[str, str]:
    """Trigger every scenario once."""
    results = run_all_scenarios()
    logger.info(f"All {len(results)} scenarios dispatched")
    return results


@app.post("/revoke/{task_id}")
def post_revoke(task_id: str, *, terminate: bool = False) -> dict[str, str]:
    """Revoke a running or pending task by ID."""
    result = AsyncResult(task_id, app=celery_app)
    result.revoke(terminate=terminate)
    logger.info(f"Revoked task {task_id} (terminate={terminate})")
    return {"task_id": task_id, "status": "revoked", "terminate": str(terminate)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
