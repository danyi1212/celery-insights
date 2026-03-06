import json
import logging
import os
import sys
from datetime import UTC, datetime
from typing import ClassVar


class UnifiedFormatter(logging.Formatter):
    """Format: 2026-03-03T21:47:02.100Z  INFO  [test-project] message"""

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

    def __init__(self) -> None:
        super().__init__()
        self.use_color = sys.stdout.isatty()

    def format(self, record: logging.LogRecord) -> str:
        now = datetime.now(tz=UTC)
        ts = now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"
        label = self.LEVEL_LABELS.get(record.levelname, record.levelname)
        msg = record.getMessage()

        if record.exc_info and record.exc_info[1]:
            msg += "\n" + self.formatException(record.exc_info)

        if self.use_color:
            color_name = self.LEVEL_COLORS.get(record.levelname, "green")
            color = self.ANSI[color_name]
            reset = self.ANSI["reset"]
            dim = self.ANSI["dim"]
            return f"{dim}{ts}{reset}  {color}{label}{reset}  {dim}[test-project]{reset} {msg}"

        return f"{ts}  {label}  [test-project] {msg}"


class JsonFormatter(logging.Formatter):
    """Single-line JSON output."""

    LEVEL_MAP: ClassVar[dict[str, str]] = {
        "DEBUG": "debug",
        "INFO": "info",
        "WARNING": "warn",
        "ERROR": "error",
        "CRITICAL": "error",
    }

    def format(self, record: logging.LogRecord) -> str:
        now = datetime.now(tz=UTC)
        ts = now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"
        msg = record.getMessage()

        if record.exc_info and record.exc_info[1]:
            msg += "\n" + self.formatException(record.exc_info)

        obj = {
            "ts": ts,
            "level": self.LEVEL_MAP.get(record.levelname, "info"),
            "service": "test-project",
            "msg": msg,
            "logger": record.name,
        }
        return json.dumps(obj)


LOG_LEVEL_MAP = {
    "debug": "DEBUG",
    "info": "INFO",
    "warn": "WARNING",
    "error": "ERROR",
}


def build_logging_config() -> dict:
    log_format = os.getenv("LOG_FORMAT", "pretty")
    log_level_env = os.getenv("LOG_LEVEL", "info").lower()
    log_level = LOG_LEVEL_MAP.get(log_level_env, "INFO")

    formatter_class = JsonFormatter if log_format == "json" else UnifiedFormatter

    return {
        "version": 1,
        "disable_existing_loggers": True,
        "formatters": {
            "unified": {
                "()": formatter_class,
            },
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
            "tasks.basic": {"level": log_level},
            "tasks.canvas": {"level": log_level},
            "tasks.failures": {"level": log_level},
            "tasks.lifecycle": {"level": log_level},
            "tasks.payloads": {"level": log_level},
            "producer.scenarios": {"level": log_level},
            "producer.interval": {"level": log_level},
            "producer.interactive": {"level": log_level},
            # Third-party loggers
            "asyncio": {"level": "WARNING"},
            "concurrent": {"level": "WARNING"},
            "amqp": {"level": "WARNING"},
            "celery": {"level": "WARNING"},
            "dotenv": {"level": "WARNING"},
            "fastapi": {"level": "WARNING"},
            "kombu": {"level": "WARNING"},
            "uvicorn": {"level": "WARNING"},
        },
    }


LOGGING_CONFIG = build_logging_config()
