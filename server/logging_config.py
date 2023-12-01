import os

from settings import Settings

LOG_FILE_PATH = os.getenv("LOG_FILE_PATH", "app.log")
LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": True,
    "formatters": {
        "color": {
            "()": "colorlog.ColoredFormatter",
            "format": "%(log_color)s[%(asctime)s.%(msecs)03d] %(levelname)s - %(name)s:%(lineno)d | %(message)s",
            "datefmt": "%H:%M:%S",
            "log_colors": {
                "DEBUG": "cyan",
                "INFO": "green",
                "WARNING": "yellow",
                "ERROR": "red",
                "CRITICAL": "red,bg_white",
            },
        },
        "file": {
            "format": "[%(asctime)s.%(msecs)03d] %(levelname)s - %(name)s.%(funcName)s::%(lineno)d | %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "color",
            "stream": "ext://sys.stdout",
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "formatter": "file",
            "filename": LOG_FILE_PATH,
            "encoding": "utf-8",
            "maxBytes": 10 * 2**20,  # 10Mb
            "backupCount": 1,
        },
    },
    "root": {
        "handlers": ["console", "file"],
        "level": "INFO",
        "propagate": False,
    },
    "loggers": {
        # Internal loggers
        "app": {"level": "INFO"},
        "tasks": {"level": "INFO"},
        "workers": {"level": "INFO"},
        "events": {"level": "INFO"},
        "events.subscriber": {"level": "DEBUG" if Settings().debug else "INFO"},
        "ws": {"level": "INFO"},
        "server_info": {"level": "INFO"},
        "celery_app": {"level": "INFO"},
        "lifespan": {"level": "INFO"},
        # Third-party loggers
        "asyncio": {"level": "INFO"},
        "concurrent": {"level": "INFO"},
        "faker": {"level": "INFO"},
        "amqp": {"level": "INFO"},
        "celery": {"level": "INFO"},
        "dotenv": {"level": "INFO"},
        "fastapi": {"level": "INFO"},
        "uvicorn": {"level": "INFO"},
        "fastapi_cache": {"level": "INFO"},
        "kombu": {"level": "INFO"},
    },
}
