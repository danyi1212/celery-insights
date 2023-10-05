from typing import Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {
        "frozen": True,
        "_case_sensitive": False,
        "_env_file": ".env",
        "_env_file_encoding": "utf-8",
    }

    debug: bool = False
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    timezone: str = "UTC"

    host: str = "0.0.0.0"
    port: int = 8555

    max_workers: int = 5000
    max_tasks: int = 10_000

    config_path: str = "/app/config.py"
    broker_url: str = "amqp://guest:guest@host.docker.internal/"
    result_backend: str = "redis://host.docker.internal:6379/0"
