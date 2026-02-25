import asyncio
import logging
import logging.config
import random

from logging_config import LOGGING_CONFIG
from producer.scenarios import SCENARIOS, run_scenario
from settings import Settings

logging.config.dictConfig(LOGGING_CONFIG)
logger = logging.getLogger(__name__)


async def interval_loop(interval: float) -> None:
    """Continuously pick a random scenario and dispatch it at the given interval."""
    scenario_names = list(SCENARIOS.keys())
    logger.info(f"Interval producer started — dispatching a random scenario every {interval}s")
    logger.info(f"Available scenarios: {sorted(scenario_names)}")

    while True:
        name = random.choice(scenario_names)
        try:
            run_scenario(name)
        except Exception:
            logger.exception(f"Failed to dispatch scenario '{name}'")
        await asyncio.sleep(interval)


async def main() -> None:
    settings = Settings()
    logger.info(f"Starting interval producer (interval={settings.produce_interval}s)")
    await interval_loop(settings.produce_interval)


if __name__ == "__main__":
    asyncio.run(main())
