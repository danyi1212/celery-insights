import uvicorn

from logging_config import build_logging_config
from settings import configure_settings, read_settings_snapshot

if __name__ == "__main__":
    settings = read_settings_snapshot()
    if not settings.bridge_socket:
        raise RuntimeError("Python requires a private Bun bridge channel")
    configure_settings(settings)
    from app import app

    app.debug = settings.debug
    uvicorn.run(
        app=app,
        uds=settings.bridge_socket,
        # This private bridge has no public ingress or user identity headers.
        proxy_headers=False,
        log_config=build_logging_config(settings.log_format, settings.log_level),
    )
