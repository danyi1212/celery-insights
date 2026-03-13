from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        frozen=True,
        case_sensitive=False,
        env_file=".env",
        env_file_encoding="utf-8",
    )

    debug: bool = False
    timezone: str = "UTC"

    host: str = "0.0.0.0"
    port: int = 8556

    # SurrealDB connection (received from Bun)
    surrealdb_url: str = "ws://localhost:8557/rpc"
    surrealdb_external_url: str | None = None
    surrealdb_ingester_pass: str = "changeme"
    surrealdb_namespace: str = "celery_insights"
    surrealdb_database: str = "main"
    surrealdb_storage: str = "memory"

    # Celery connection (received from Bun)
    broker_url: str = "amqp://guest:guest@host.docker.internal/"
    result_backend: str = "redis://host.docker.internal:6379/0"
    config_file: str = "/app/config.py"

    # Data retention (received from Bun)
    cleanup_interval_seconds: int = 60
    task_max_count: int | None = None
    task_retention_hours: float | None = None
    dead_worker_retention_hours: float | None = 24

    # Ingestion performance (received from Bun)
    ingestion_batch_interval_ms: int = 100
