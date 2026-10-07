import asyncio
import json
import shutil
import socket
import subprocess
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import httpx
import pytest
from surrealdb import AsyncSurreal

from exports.router import (
    ExplorerCsvExportRequest,
    _build_task_query,
    _build_workflow_query,
    _extract_id,
    _extract_rows,
)
from exports.task_search import build_task_search

FIXTURES = json.loads(
    (Path(__file__).resolve().parents[2] / "src" / "lib" / "task-search-fixtures.json").read_text(encoding="utf-8")
)
WIDE_RANGE = {"from": "2000-01-01T00:00:00Z", "to": "2100-01-01T00:00:00Z"}

pytestmark = pytest.mark.skipif(shutil.which("surreal") is None, reason="SurrealDB 3.3+ CLI required")


async def _seed(url: str) -> None:
    async with AsyncSurreal(url) as connection:
        await connection.signin({"username": "root", "password": "root"})
        await connection.use("test", "export_search")
        for task in FIXTURES["tasks"]:
            content = {key: value for key, value in task.items() if key not in {"id", "format"}}
            await connection.query(
                "CREATE type::record('task', $id) CONTENT $content", {"id": task["id"], "content": content}
            )
        for workflow in FIXTURES["workflows"]:
            content = {key: value for key, value in workflow.items() if key != "id"}
            await connection.query(
                "CREATE type::record('workflow', $id) CONTENT $content", {"id": workflow["id"], "content": content}
            )
        await connection.query(
            "UPDATE task SET last_updated = time::now(); UPDATE workflow SET last_updated = time::now()"
        )


async def _wait_for_health(port: int) -> None:
    async with httpx.AsyncClient() as http:
        for _ in range(200):
            try:
                if (await http.get(f"http://127.0.0.1:{port}/health")).is_success:
                    return
            except httpx.HTTPError:
                pass
            await asyncio.sleep(0.05)
    raise RuntimeError("SurrealDB did not start")


@pytest.fixture(scope="module")
def database_url() -> Iterator[str]:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    process = subprocess.Popen(
        ["surreal", "start", "--bind", f"127.0.0.1:{port}", "--user", "root", "--pass", "root", "memory"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        asyncio.run(_wait_for_health(port))
        url = f"ws://127.0.0.1:{port}/rpc"
        asyncio.run(_seed(url))
        yield url
    finally:
        process.kill()


def _payload(mode: str, query: str) -> ExplorerCsvExportRequest:
    return ExplorerCsvExportRequest.model_validate({"kind": "explorer", "mode": mode, "query": query, **WIDE_RANGE})


async def _connect(url: str) -> Any:
    connection = AsyncSurreal(url)
    await connection.connect(url)
    await connection.signin({"username": "root", "password": "root"})
    await connection.use("test", "export_search")
    return connection


async def _ids(db: Any, sql: str, bindings: dict[str, Any]) -> list[str]:
    return sorted(_extract_id(row.get("id")) for row in _extract_rows(await db.query(sql, bindings)))


@pytest.mark.asyncio
@pytest.mark.parametrize(("query", "expected"), [(case["query"], case["expected"]) for case in FIXTURES["queries"]])
async def test_task_export_matches_explorer_vectors(database_url: str, query: str, expected: list[str]) -> None:
    db = await _connect(database_url)
    try:
        sql, bindings = _build_task_query(_payload("tasks", query))
        assert await _ids(db, sql, bindings) == expected
    finally:
        await db.close()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("query", "expected"), [(case["query"], case["expected"]) for case in FIXTURES["workflowQueries"]]
)
async def test_workflow_export_matches_explorer_vectors(database_url: str, query: str, expected: list[str]) -> None:
    db = await _connect(database_url)
    try:
        sql, bindings = await _build_workflow_query(db, _payload("workflows", query))
        assert await _ids(db, sql, bindings) == expected
    finally:
        await db.close()


def test_oversized_literal_falls_back_to_plain_text() -> None:
    search = build_task_search("items=[" + ",".join(['"item"'] * 20_000) + "]")
    assert "kwargsPattern" not in search.bindings
    assert "string::matches" not in search.clause
