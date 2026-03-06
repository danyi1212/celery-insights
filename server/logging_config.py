import os
import sys
from datetime import UTC, datetime
from typing import ClassVar

from dans_log_formatter import TextLogFormatter


class UnifiedTextFormatter(TextLogFormatter):
    """Extends TextLogFormatter with unified format: ISO_TS  LEVEL  [python] message"""

    LEVEL_LABELS: ClassVar[dict[str, str]] = {
        "DEBUG": "DEBUG",
        "INFO": " INFO",
        "WARNING": " WARN",
        "ERROR": "ERROR",
        "CRITICAL": "ERROR",
    }

    ANSI: ClassVar[dict[str, str]] = {
        "reset": "\x1b[0m",
        "dim": "\x1b[2m",
        "cyan": "\x1b[36m",
        "green": "\x1b[32m",
        "yellow": "\x1b[33m",
        "red": "\x1b[31m",
    }

    LEVEL_COLORS: ClassVar[dict[str, str]] = {
        "DEBUG": "cyan",
        "INFO": "green",
        "WARNING": "yellow",
        "ERROR": "red",
        "CRITICAL": "red",
    }

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self.use_color = sys.stdout.isatty()

    def format_timestamp(self, record) -> str:  # noqa: ARG002
        now = datetime.now(tz=UTC)
        return now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"

    def format(self, record):
        # Get provider attributes injected onto the record
        super().format(record)

        ts = self.format_timestamp(record)
        label = self.LEVEL_LABELS.get(record.levelname, record.levelname)
        msg = self.format_message(record)

        if record.exc_info and record.exc_info[1]:
            msg += "\n" + self.formatException(record.exc_info)

        if self.use_color:
            color_name = self.LEVEL_COLORS.get(record.levelname, "green")
            color = self.ANSI[color_name]
            reset = self.ANSI["reset"]
            dim = self.ANSI["dim"]
            return f"{dim}{ts}{reset}  {color}{label}{reset}  {dim}[python]{reset} {msg}"

        return f"{ts}  {label}  [python] {msg}"


LOG_LEVEL_MAP: dict[str, str] = {
    "debug": "DEBUG",
    "info": "INFO",
    "warn": "WARNING",
    "error": "ERROR",
}


def build_logging_config() -> dict:
    log_format = os.getenv("LOG_FORMAT", "pretty")
    log_level_env = os.getenv("LOG_LEVEL", "info").lower()
    log_level = LOG_LEVEL_MAP.get(log_level_env, "INFO")

    if log_format == "json":
        formatter_config: dict = {
            "()": "dans_log_formatter.JsonLogFormatter",
        }
    else:
        formatter_config = {
            "()": UnifiedTextFormatter,
        }

    return {
        "version": 1,
        "disable_existing_loggers": True,
        "formatters": {
            "unified": formatter_config,
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "unified",
                "stream": "ext://sys.stdout",
            },
        },
        "root": {
            "handlers": ["console"],
            "level": log_level,
            "propagate": False,
        },
        "loggers": {
            # Internal loggers
            "app": {"level": log_level},
            "tasks": {"level": log_level},
            "workers": {"level": log_level},
            "events": {"level": log_level},
            "events.ingester": {"level": log_level},
            "server_info": {"level": log_level},
            "celery_app": {"level": log_level},
            "lifespan": {"level": log_level},
            "surrealdb_client": {"level": log_level},
            "tasks.result_fetcher": {"level": log_level},
            "workers.poller": {"level": log_level},
            "cleanup": {"level": log_level},
            # Third-party loggers (keep quiet)
            "asyncio": {"level": "WARNING"},
            "concurrent": {"level": "WARNING"},
            "faker": {"level": "WARNING"},
            "amqp": {"level": "WARNING"},
            "celery": {"level": "WARNING"},
            "dotenv": {"level": "WARNING"},
            "fastapi": {"level": "WARNING"},
            "uvicorn": {"level": "WARNING"},
            "uvicorn.access": {"level": "WARNING"},
            "fastapi_cache": {"level": "WARNING"},
            "kombu": {"level": "WARNING"},
            "redis": {"level": "WARNING"},
            "server": {"level": "WARNING"},
            "tzlocal": {"level": "WARNING"},
            "aiohttp": {"level": "WARNING"},
            "charset_normalizer": {"level": "WARNING"},
            "requests": {"level": "WARNING"},
            "urllib3": {"level": "WARNING"},
        },
    }


LOGGING_CONFIG = build_logging_config()
