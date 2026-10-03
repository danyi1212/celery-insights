from __future__ import annotations

import pytest

from settings import Settings


def test_default_settings(monkeypatch: pytest.MonkeyPatch):
    """Test programmatic defaults (not .env values, since .env loading depends on CWD)."""
    # Clear env vars that .env might set, ensuring we test pure defaults
    for key in ("DEBUG", "PORT", "BROKER_URL", "RESULT_BACKEND"):
        monkeypatch.delenv(key, raising=False)

    settings = Settings()
    assert settings.debug is False
    assert settings.timezone == "UTC"
    assert settings.surrealdb_url == "ws://localhost:8557/rpc"
    assert settings.surrealdb_external_url is None
    assert settings.surrealdb_ingester_pass == "changeme"
    assert settings.surrealdb_namespace == "celery_insights"
    assert settings.surrealdb_database == "main"
    assert settings.broker_url == "amqp://guest:guest@host.docker.internal/"
    assert settings.result_backend == "redis://host.docker.internal:6379/0"
    assert settings.config_file == "/app/config.py"
    assert settings.debug_snapshot_mode is False
    assert settings.ingestion_batch_interval_ms == 100


def test_surrealdb_settings_override():
    settings = Settings(
        surrealdb_url="ws://custom:9999/rpc",
        surrealdb_external_url="wss://surreal.example.com/rpc",
        surrealdb_ingester_pass="secret",
        surrealdb_namespace="custom_ns",
        surrealdb_database="custom_db",
    )
    assert settings.surrealdb_url == "ws://custom:9999/rpc"
    assert settings.surrealdb_external_url == "wss://surreal.example.com/rpc"
    assert settings.surrealdb_ingester_pass == "secret"
    assert settings.surrealdb_namespace == "custom_ns"
    assert settings.surrealdb_database == "custom_db"


def test_bridge_snapshot_rejects_application_configuration():
    from pydantic import ValidationError

    for field in ("host", "port", "bridge_token", "authentication", "task_max_count", "cleanup_interval_seconds"):
        with pytest.raises(ValidationError):
            Settings.model_validate({field: "not-for-python"})


def test_snapshot_mode_override():
    settings = Settings(debug_snapshot_mode=True)
    assert settings.debug_snapshot_mode is True
