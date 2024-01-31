from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        frozen=True,
        case_sensitive=False,
        env_file=".env",
        env_file_encoding="utf-8",
    )

    broker_url: str = "amqp://guest:guest@host.docker.internal/"
    result_backend: str = "redis://host.docker.internal:6379/0"
