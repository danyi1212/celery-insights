from pydantic import BaseSettings


class Settings(BaseSettings):
    debug: bool = False

    host: str = "0.0.0.0"
    port: int = 8555


settings = Settings()
