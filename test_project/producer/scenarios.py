import logging
import random

from celery import chain, chord, group
from celery.canvas import Signature

from tasks.basic import add, noop, random_sleep, secondary_queue_task, sleep_task
from tasks.canvas import accumulate, on_error, on_success, order_workflow, step
from tasks.failures import (
    always_fails,
    deep_traceback,
    division_by_zero,
    random_failure,
    reject_task,
    retry_manual,
    retry_with_backoff,
)
from tasks.lifecycle import countdown_task, eta_task, long_running, replace_with_chain
from tasks.payloads import (
    dict_result,
    large_args,
    large_result,
    list_result,
    none_result,
    numeric_result,
    string_result,
)

logger = logging.getLogger(__name__)


def _build_scenarios() -> dict[str, callable]:
    """Build a mapping of scenario name -> callable that returns a Celery signature."""

    def scenario_chain() -> Signature:
        return chain(step.s("A", 0), step.s("B"), step.s("C"))

    def scenario_chord() -> Signature:
        return chord([step.s("W1", 0), step.s("W2", 0), step.s("W3", 0)], accumulate.s())

    def scenario_group() -> Signature:
        return group(random_sleep.s(0.5, 2.0) for _ in range(4))

    def scenario_link() -> Signature:
        return add.s(2, 3).set(link=on_success.s())

    def scenario_link_error() -> Signature:
        return always_fails.si().set(link_error=on_error.s())

    def scenario_order_workflow() -> Signature:
        return order_workflow.si()

    def scenario_always_fails() -> Signature:
        return always_fails.si()

    def scenario_random_failure() -> Signature:
        return random_failure.s(0.6)

    def scenario_retry_backoff() -> Signature:
        return retry_with_backoff.si()

    def scenario_retry_manual() -> Signature:
        return retry_manual.si()

    def scenario_division_by_zero() -> Signature:
        return division_by_zero.si()

    def scenario_deep_traceback() -> Signature:
        return deep_traceback.s(8)

    def scenario_reject() -> Signature:
        return reject_task.si()

    def scenario_replace() -> Signature:
        return replace_with_chain.si()

    def scenario_long_running() -> Signature:
        return long_running.s(20.0)

    def scenario_eta() -> Signature:
        return eta_task.si()

    def scenario_countdown() -> Signature:
        return countdown_task.si()

    def scenario_dict_result() -> Signature:
        return dict_result.si()

    def scenario_list_result() -> Signature:
        return list_result.si()

    def scenario_string_result() -> Signature:
        return string_result.si()

    def scenario_none_result() -> Signature:
        return none_result.si()

    def scenario_large_args() -> Signature:
        return large_args.s("A" * 50_000)

    def scenario_large_result() -> Signature:
        return large_result.s(50_000)

    def scenario_numeric_result() -> Signature:
        return numeric_result.si()

    def scenario_noop() -> Signature:
        return noop.si()

    def scenario_add() -> Signature:
        return add.s(random.randint(1, 100), random.randint(1, 100))

    def scenario_sleep() -> Signature:
        return sleep_task.s(random.uniform(1.0, 5.0))

    def scenario_secondary_queue() -> Signature:
        return secondary_queue_task.si()

    return {
        "chain": scenario_chain,
        "chord": scenario_chord,
        "group": scenario_group,
        "link": scenario_link,
        "link_error": scenario_link_error,
        "order_workflow": scenario_order_workflow,
        "always_fails": scenario_always_fails,
        "random_failure": scenario_random_failure,
        "retry_backoff": scenario_retry_backoff,
        "retry_manual": scenario_retry_manual,
        "division_by_zero": scenario_division_by_zero,
        "deep_traceback": scenario_deep_traceback,
        "reject": scenario_reject,
        "replace": scenario_replace,
        "long_running": scenario_long_running,
        "eta": scenario_eta,
        "countdown": scenario_countdown,
        "dict_result": scenario_dict_result,
        "list_result": scenario_list_result,
        "string_result": scenario_string_result,
        "none_result": scenario_none_result,
        "large_args": scenario_large_args,
        "large_result": scenario_large_result,
        "numeric_result": scenario_numeric_result,
        "noop": scenario_noop,
        "add": scenario_add,
        "sleep": scenario_sleep,
        "secondary_queue": scenario_secondary_queue,
    }


SCENARIOS = _build_scenarios()


def run_scenario(name: str) -> str:
    """Run a named scenario and return the task/group ID."""
    if name not in SCENARIOS:
        raise KeyError(f"Unknown scenario: {name}. Available: {sorted(SCENARIOS.keys())}")
    signature = SCENARIOS[name]()
    result = signature.apply_async()
    task_id = result.id
    logger.info(f"Scenario '{name}' dispatched -> {task_id}")
    return task_id


def run_all_scenarios() -> dict[str, str]:
    """Run every scenario and return a mapping of name -> task ID."""
    results = {}
    for name in SCENARIOS:
        results[name] = run_scenario(name)
    return results


def list_scenarios() -> list[str]:
    """Return the list of available scenario names."""
    return sorted(SCENARIOS.keys())
