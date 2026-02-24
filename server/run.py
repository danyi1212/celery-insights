import uvicorn

from logging_config import LOGGING_CONFIG
from settings import Settings

if __name__ == "__main__":
    settings = Settings()
    uvicorn.run(
        app="app:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_config=LOGGING_CONFIG,
    )
