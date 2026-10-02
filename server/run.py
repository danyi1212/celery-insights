import uvicorn

from logging_config import build_logging_config
from settings import configure_settings, read_settings_snapshot

if __name__ == "__main__":
    settings = read_settings_snapshot()
    configure_settings(settings)
    from app import app

    app.debug = settings.debug
    uvicorn.run(
        app=app,
        host=settings.host,
        port=settings.port,
        log_config=build_logging_config(settings.log_format, settings.log_level),
    )
