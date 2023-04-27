from pydantic import BaseModel

from settings import Settings


class LoggingConfig(BaseModel):
    version = 1
    disable_existing_loggers = False
    formatters = {
        "default": {
            "()": "uvicorn.logging.DefaultFormatter",
            "fmt": "[%(asctime)s.%(msecs)03d] %(levelname)s - %(module)s:%(lineno)d | %(message)s",
            'datefmt': "%H:%M:%S",
        },
    }
    handlers = {
        "default": {
            "formatter": "default",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stderr",
        },
    }
    loggers = {
        name: {
            "handlers": ["default"],
            "level": Settings().log_level,
        }
        for name in ["app", "tasks", "workers", "events", "ws", "server_info"]
    }
