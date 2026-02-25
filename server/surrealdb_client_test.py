from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import surrealdb_client
from settings import Settings


@pytest.fixture(autouse=True)
def _reset_singleton():
    """Reset the module-level singleton before each test."""
    surrealdb_client._db = None
    surrealdb_client._lock = asyncio.Lock()
    yield
    surrealdb_client._db = None


def _make_settings() -> Settings:
    return Settings(
        surrealdb_url="ws://localhost:8557/rpc",
        surrealdb_ingester_pass="testpass",
        surrealdb_namespace="test_ns",
        surrealdb_database="test_db",
    )


@pytest.mark.asyncio
async def test_connect_surrealdb_calls_signin_and_use():
    settings = _make_settings()
    mock_db = AsyncMock()

    with patch("surrealdb_client.AsyncSurreal", return_value=mock_db):
        result = await surrealdb_client.connect_surrealdb(settings)

    assert result is mock_db
    mock_db.signin.assert_awaited_once_with({"username": "ingester", "password": "testpass"})
    mock_db.use.assert_awaited_once_with("test_ns", "test_db")


@pytest.mark.asyncio
async def test_init_surrealdb_returns_singleton():
    settings = _make_settings()
    mock_db = AsyncMock()

    with patch("surrealdb_client.connect_surrealdb", new_callable=AsyncMock, return_value=mock_db):
        db1 = await surrealdb_client.init_surrealdb(settings)
        db2 = await surrealdb_client.init_surrealdb(settings)

    assert db1 is db2
    assert db1 is mock_db


@pytest.mark.asyncio
async def test_init_surrealdb_retries_on_failure():
    settings = _make_settings()
    mock_db = AsyncMock()

    call_count = 0

    async def connect_side_effect(_settings):
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise ConnectionError("Connection refused")
        return mock_db

    with (
        patch("surrealdb_client.connect_surrealdb", side_effect=connect_side_effect),
        patch("surrealdb_client.asyncio.sleep", new_callable=AsyncMock) as mock_sleep,
    ):
        result = await surrealdb_client.init_surrealdb(settings)

    assert result is mock_db
    assert call_count == 3
    # First retry sleeps 1s, second sleeps 2s
    assert mock_sleep.await_count == 2
    mock_sleep.assert_any_await(1.0)
    mock_sleep.assert_any_await(2.0)


@pytest.mark.asyncio
async def test_init_surrealdb_exponential_backoff_caps_at_30s():
    settings = _make_settings()
    mock_db = AsyncMock()

    call_count = 0

    async def connect_side_effect(_settings):
        nonlocal call_count
        call_count += 1
        # Fail 7 times: delays would be 1, 2, 4, 8, 16, 30, 30
        if call_count <= 7:
            raise ConnectionError("Connection refused")
        return mock_db

    with (
        patch("surrealdb_client.connect_surrealdb", side_effect=connect_side_effect),
        patch("surrealdb_client.asyncio.sleep", new_callable=AsyncMock) as mock_sleep,
    ):
        result = await surrealdb_client.init_surrealdb(settings)

    assert result is mock_db
    sleep_values = [call.args[0] for call in mock_sleep.await_args_list]
    assert sleep_values == [1.0, 2.0, 4.0, 8.0, 16.0, 30.0, 30.0]


def test_get_db_raises_when_not_initialized():
    with pytest.raises(RuntimeError, match="SurrealDB connection not initialized"):
        surrealdb_client.get_db()


@pytest.mark.asyncio
async def test_get_db_returns_initialized_connection():
    mock_db = AsyncMock()
    surrealdb_client._db = mock_db

    result = surrealdb_client.get_db()
    assert result is mock_db


@pytest.mark.asyncio
async def test_close_surrealdb():
    mock_db = AsyncMock()
    surrealdb_client._db = mock_db

    await surrealdb_client.close_surrealdb()

    mock_db.close.assert_awaited_once()
    assert surrealdb_client._db is None


@pytest.mark.asyncio
async def test_close_surrealdb_noop_when_not_connected():
    await surrealdb_client.close_surrealdb()
    assert surrealdb_client._db is None


@pytest.mark.asyncio
async def test_init_uses_default_settings_when_none():
    mock_db = AsyncMock()

    with (
        patch("surrealdb_client.connect_surrealdb", new_callable=AsyncMock, return_value=mock_db),
        patch("surrealdb_client.Settings") as mock_settings_cls,
    ):
        mock_settings_cls.return_value = MagicMock()
        result = await surrealdb_client.init_surrealdb(None)

    assert result is mock_db
    mock_settings_cls.assert_called_once()
