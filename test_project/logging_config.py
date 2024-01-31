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
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "color",
            "stream": "ext://sys.stdout",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
        "propagate": False,
    },
    "loggers": {
        # Internal loggers
        "app": {"level": "INFO"},
        "producer": {"level": "INFO"},
        # Third-party loggers
        "asyncio": {"level": "INFO"},
        "concurrent": {"level": "INFO"},
        "faker": {"level": "INFO"},
        "amqp": {"level": "INFO"},
        "celery": {"level": "INFO"},
        "dotenv": {"level": "INFO"},
        "fastapi": {"level": "INFO"},
        "fastapi_cache": {"level": "INFO"},
        "kombu": {"level": "INFO"},
    },
}
