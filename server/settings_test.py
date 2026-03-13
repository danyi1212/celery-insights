from __future__ import annotations

import pytest

from settings import Settings


def test_default_settings(monkeypatch: pytest.MonkeyPatch):
    """Test programmatic defaults (not .env values, since .env loading depends on CWD)."""
    # Clear env vars that .env might set, ensuring we test pure defaults
    for key in ("DEBUG", "PORT", "BROKER_URL", "RESULT_BACKEND"):
        monkeypatch.delenv(key, raising=False)

    settings = Settings(_env_file=None)  # type: ignore[call-arg]
    assert settings.debug is False
    assert settings.timezone == "UTC"
    assert settings.host == "0.0.0.0"
    assert settings.port == 8556
    assert settings.surrealdb_url == "ws://localhost:8557/rpc"
    assert settings.surrealdb_external_url is None
    assert settings.surrealdb_ingester_pass == "changeme"
    assert settings.surrealdb_namespace == "celery_insights"
    assert settings.surrealdb_database == "main"
    assert settings.surrealdb_storage == "memory"
    assert settings.broker_url == "amqp://guest:guest@host.docker.internal/"
    assert settings.result_backend == "redis://host.docker.internal:6379/0"
    assert settings.config_file == "/app/config.py"
    assert settings.cleanup_interval_seconds == 60
    assert settings.task_max_count is None
    assert settings.task_retention_hours is None
    assert settings.dead_worker_retention_hours == 24
    assert settings.ingestion_batch_interval_ms == 100


def test_surrealdb_settings_override():
    settings = Settings(
        surrealdb_url="ws://custom:9999/rpc",
        surrealdb_external_url="wss://surreal.example.com/rpc",
        surrealdb_ingester_pass="secret",
        surrealdb_namespace="custom_ns",
        surrealdb_database="custom_db",
        surrealdb_storage="rocksdb:/data/surreal",
    )
    assert settings.surrealdb_url == "ws://custom:9999/rpc"
    assert settings.surrealdb_external_url == "wss://surreal.example.com/rpc"
    assert settings.surrealdb_ingester_pass == "secret"
    assert settings.surrealdb_namespace == "custom_ns"
    assert settings.surrealdb_database == "custom_db"
    assert settings.surrealdb_storage == "rocksdb:/data/surreal"


def test_retention_settings_override():
    settings = Settings(
        task_max_count=5000,
        task_retention_hours=72.0,
        dead_worker_retention_hours=48.0,
        ingestion_batch_interval_ms=200,
        cleanup_interval_seconds=120,
    )
    assert settings.task_max_count == 5000
    assert settings.task_retention_hours == 72.0
    assert settings.dead_worker_retention_hours == 48.0
    assert settings.ingestion_batch_interval_ms == 200
    assert settings.cleanup_interval_seconds == 120


def test_task_max_count_none():
    settings = Settings(task_max_count=None)
    assert settings.task_max_count is None


def test_dead_worker_retention_none():
    settings = Settings(dead_worker_retention_hours=None)
    assert settings.dead_worker_retention_hours is None
