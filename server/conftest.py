import asyncio
import shutil
import socket
import subprocess
from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest
import pytest_asyncio
from surrealdb.connections.async_ws import AsyncWsSurrealConnection


@pytest_asyncio.fixture
async def surreal_db() -> AsyncIterator[AsyncWsSurrealConnection]:
    if shutil.which("surreal") is None:
        pytest.skip("SurrealDB 3.3+ CLI required")
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    process = subprocess.Popen(
        ["surreal", "start", "--bind", f"127.0.0.1:{port}", "--user", "root", "--pass", "root", "memory"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        async with httpx.AsyncClient() as http:
            for _ in range(100):
                try:
                    if (await http.get(f"http://127.0.0.1:{port}/health")).is_success:
                        break
                except httpx.ConnectError:
                    pass
                await asyncio.sleep(0.1)
            else:
                pytest.fail("SurrealDB did not start")
        async with AsyncWsSurrealConnection(f"ws://127.0.0.1:{port}/rpc") as database:
            await database.signin({"username": "root", "password": "root"})
            await database.use("integration", "execution")
            source = (Path(__file__).parents[1] / "runtime/surreal-schema.ts").read_text()
            schema = source.split("export const CORE_SCHEMA = `", 1)[1].split("`", 1)[0]
            await database.query(schema)
            yield database
    finally:
        process.terminate()
        await asyncio.to_thread(process.wait, timeout=10)
