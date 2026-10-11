import json
import os
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Settings(BaseModel):
    """Typed process snapshot; never reads environment variables or config files."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    debug: bool = False
    timezone: str = "UTC"

    # SurrealDB connection (received from Bun)
    surrealdb_url: str = "ws://localhost:8557/rpc"
    surrealdb_external_url: str | None = None
    surrealdb_ingester_pass: str = Field(default="changeme", repr=False)
    surrealdb_namespace: str = "celery_insights"
    surrealdb_database: str = "main"

    # Celery connection (received from Bun)
    broker_url: str = Field(default="amqp://guest:guest@host.docker.internal/", repr=False)
    result_backend: str = Field(default="redis://host.docker.internal:6379/0", repr=False)
    config_file: str = "/app/config.py"
    celery_options: dict = Field(default_factory=dict, repr=False)
    debug_snapshot_mode: bool = False
    log_format: Literal["pretty", "json"] = "pretty"
    log_level: Literal["debug", "info", "warn", "error"] = "info"

    # Ingestion performance (received from Bun)
    search_indexing_enabled: bool = False
    ingestion_batch_interval_ms: int = 100
    bridge_socket: str = ""


_runtime_settings: Settings | None = None
MAX_HANDOFF_BYTES = 32 * 1024 * 1024


def configure_settings(settings: Settings) -> None:
    global _runtime_settings
    _runtime_settings = settings


def get_settings() -> Settings:
    if _runtime_settings is None:
        raise RuntimeError("Python requires a resolved configuration snapshot from the Bun launcher")
    return _runtime_settings


def read_settings_snapshot(fd: int = 3) -> Settings:
    """Read bounded private IPC data. Bun has already resolved and validated config."""
    try:
        with os.fdopen(fd, "rb") as stream:
            content = stream.read(MAX_HANDOFF_BYTES + 1)
        if len(content) > MAX_HANDOFF_BYTES:
            raise ValueError
        envelope = json.loads(content)
        if (
            not isinstance(envelope, dict)
            or set(envelope) != {"version", "settings"}
            or type(envelope["version"]) is not int
            or envelope["version"] != 1
        ):
            raise ValueError
        settings_data = envelope["settings"]
        if not isinstance(settings_data, dict) or set(settings_data) != set(Settings.model_fields):
            raise ValueError
        return Settings.model_validate(settings_data, strict=True)
    except OSError, ValueError, TypeError:
        raise RuntimeError("Invalid or missing Bun configuration handoff") from None
