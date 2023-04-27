from typing import Literal

from pydantic import BaseSettings


class Settings(BaseSettings):
    debug: bool = False
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

    host: str = "0.0.0.0"
    port: int = 8555

    broker_url: str = "amqp://guest:guest@localhost/"
    result_backend: str = 'redis://localhost:6379/0'

    class Config(BaseSettings.Config):
        env_file = ".env"
        env_file_encoding = "utf-8"
