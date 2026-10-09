import asyncio
import json
import os
import shutil
import socket
import subprocess
from collections.abc import Iterator
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock

import httpx
import pytest
from surrealdb import AsyncSurreal

from surrealdb_test_helpers import _extract_id, _extract_rows, _query_last
from tasks.task_search import (
    build_task_search,
    build_workflow_search,
    kwargs_search_terms,
    keyword_search_term,
    build_indexed_task_search,
    build_indexed_workflow_search,
)

FIXTURES = json.loads(
    (Path(__file__).resolve().parents[2] / "src" / "lib" / "task-search-fixtures.json").read_text(encoding="utf-8")
)
WIDE_RANGE = {"from": "2000-01-01T00:00:00Z", "to": "2100-01-01T00:00:00Z"}

# CI must run the native SurrealDB vectors; a local run without the CLI skips them, and -rs lists the reason.
requires_surreal = pytest.mark.skipif(
    shutil.which("surreal") is None and not os.environ.get("CI"), reason="SurrealDB 3.3+ CLI not on PATH"
)


async def _seed(url: str, mode: str) -> None:
    async with AsyncSurreal(url) as connection:
        await connection.signin({"username": "root", "password": "root"})
        await connection.use("test", "export_search")
        await connection.query("DEFINE TABLE IF NOT EXISTS search_config SCHEMALESS")
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

        if mode != "disabled":
            schema = Path(__file__).resolve().parents[2] / "runtime" / "search-index-schema.surql"
            await connection.query(schema.read_text())
            await connection.query(
                "FOR $row IN (SELECT * FROM task) { fn::search_project_task($row, $row); }; "
                "FOR $row IN (SELECT * FROM workflow) { fn::search_project_workflow($row, $row); };"
            )
            for task in FIXTURES["tasks"]:
                terms = kwargs_search_terms(task.get("kwargs"), task.get("format", "").removesuffix("_compact"))
                await _query_last(
                    connection,
                    "UPDATE type::record('task_search', $id) SET kwargs_terms = $terms, kwargs_fallback = $fallback",
                    {"id": task["id"], "terms": terms.terms, "fallback": terms.fallback},
                )
            await connection.query(
                "UPSERT search_config:current SET enabled = true, ready = $ready", {"ready": mode != "building"}
            )
            if mode == "missing-index":
                await connection.query("REMOVE INDEX ci_search_task_grams ON task_search")


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


@pytest.fixture(scope="module", params=["disabled", "enabled", "building", "missing-index"])
def database_url(request: pytest.FixtureRequest, tmp_path_factory: pytest.TempPathFactory) -> Iterator[str]:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    process = subprocess.Popen(
        [
            "surreal",
            "start",
            "--bind",
            f"127.0.0.1:{port}",
            "--user",
            "root",
            "--pass",
            "root",
            f"surrealkv://{tmp_path_factory.mktemp('search')}/data",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        asyncio.run(_wait_for_health(port))
        url = f"ws://127.0.0.1:{port}/rpc"
        asyncio.run(_seed(url, request.param))
        yield url
    finally:
        process.kill()


def _search_query(mode: str, query: str) -> tuple[str, dict[str, str | None]]:
    search = build_indexed_task_search(query) if mode == "tasks" else build_indexed_workflow_search(query)
    return (
        "".join(search.prelude) + f"SELECT * FROM {search.source} WHERE ({search.clause}) "
        "AND last_updated >= <datetime>$from AND last_updated <= <datetime>$to ORDER BY last_updated DESC",
        {**search.bindings, **WIDE_RANGE},
    )


async def _connect(url: str) -> Any:
    connection = AsyncSurreal(url)
    await connection.connect(url)
    await connection.signin({"username": "root", "password": "root"})
    await connection.use("test", "export_search")
    return connection


async def _ids(db: Any, sql: str, bindings: dict[str, Any]) -> list[str]:
    return sorted(_extract_id(row.get("id")) for row in _extract_rows(await _query_last(db, sql, bindings)))


@requires_surreal
@pytest.mark.asyncio
@pytest.mark.parametrize(("query", "expected"), [(case["query"], case["expected"]) for case in FIXTURES["queries"]])
async def test_task_search_matches_shared_vectors(database_url: str, query: str, expected: list[str]) -> None:
    db = await _connect(database_url)
    try:
        sql, bindings = _search_query("tasks", query)
        assert await _ids(db, sql, bindings) == expected
    finally:
        await db.close()


@requires_surreal
@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("query", "expected"), [(case["query"], case["expected"]) for case in FIXTURES["workflowQueries"]]
)
async def test_workflow_search_matches_shared_vectors(database_url: str, query: str, expected: list[str]) -> None:
    db = await _connect(database_url)
    try:
        sql, bindings = _search_query("workflows", query)
        assert await _ids(db, sql, bindings) == expected
    finally:
        await db.close()


def test_plain_text_workflow_search_skips_member_tasks() -> None:
    search = build_workflow_search("north team")
    assert search.prelude == []
    assert "$searchWorkflows" not in search.clause


@pytest.mark.asyncio
async def test_query_last_raises_on_a_failed_statement() -> None:
    db = AsyncMock()
    db.query_raw.return_value = {"result": [{"status": "ERR", "result": "boom"}, {"status": "OK", "result": []}]}
    with pytest.raises(RuntimeError, match="boom"):
        await _query_last(db, "LET $a = 1; SELECT * FROM workflow", {})


def test_oversized_literal_falls_back_to_plain_text() -> None:
    search = build_task_search("items=[" + ",".join(['"item"'] * 20_000) + "]")
    assert "kwargsPattern" not in search.bindings
    assert "string::matches" not in search.clause


def test_deeply_nested_literal_falls_back_to_plain_text() -> None:
    search = build_task_search("items=" + "[" * 600 + "0" + "]" * 600)
    assert "kwargsPattern" not in search.bindings
    assert "string::matches" not in search.clause


def test_surrogate_escape_keeps_pattern_encodable() -> None:
    search = build_task_search("label='\\ud800'")
    search.bindings["kwargsPattern"].encode("utf-8")


def test_exact_terms_preserve_types_number_spelling_and_nested_order():
    terms = kwargs_search_terms("{'id': 9007199254740993, 'ratio': 1.0, 'nested': {'id': '1'}}", "repr")
    assert not terms.fallback
    for query in ["id=9007199254740993", "ratio=1.0", "id='1'", "nested={'id': '1'}"]:
        assert keyword_search_term(query) in terms.terms
    assert keyword_search_term("ratio=1") not in terms.terms
    assert kwargs_search_terms("{'id': 1}", None).fallback
    assert kwargs_search_terms("{'id': 1, 'text': 'a\\nb'}", "saferepr").fallback


def test_disabled_ingestion_skips_search_normalization(mocker):
    from events.ingester import build_task_upsert
    from tasks.result_fetcher import _build_task_meta_upsert

    normalize_events = mocker.patch(
        "events.ingester.kwargs_search_terms", side_effect=AssertionError("must not normalize")
    )
    normalize_results = mocker.patch(
        "tasks.result_fetcher.kwargs_search_terms", side_effect=AssertionError("must not normalize")
    )
    event = {"type": "task-sent", "uuid": "disabled", "timestamp": 1700000000, "kwargs": "{'id': 1}"}
    sql, _ = build_task_upsert(event, 0, search_indexing_enabled=False)
    assert "task_search" not in sql
    sql, _ = _build_task_meta_upsert("disabled", {"kwargs": {"id": 1}}, search_indexing_enabled=False)
    assert "task_search" not in sql
    normalize_events.assert_not_called()
    normalize_results.assert_not_called()


@requires_surreal
@pytest.mark.asyncio
async def test_ingested_kwargs_updates_and_stale_events_keep_search_terms_current(database_url: str) -> None:
    from events.ingester import build_task_upsert
    from tasks.result_fetcher import _build_task_meta_upsert

    db = await _connect(database_url)
    try:
        for timestamp, number in [(1700000001, 987654), (1700000000, 987655)]:
            sql, bindings = build_task_upsert(
                {
                    "type": "task-sent",
                    "uuid": "ingestion-test",
                    "timestamp": timestamp,
                    "kwargs": f"{{'organization_id': {number}}}",
                },
                0,
                search_indexing_enabled=True,
            )
            await _query_last(db, sql, bindings)
        sql, bindings = _search_query("tasks", "organization_id=987654")
        assert "ingestion-test" in await _ids(db, sql, bindings)
        sql, bindings = _search_query("tasks", "organization_id=987655")
        assert "ingestion-test" not in await _ids(db, sql, bindings)
        sql, bindings = _build_task_meta_upsert(
            "ingestion-test", {"status": "SUCCESS", "kwargs": {"organization_id": 987656}}, search_indexing_enabled=True
        )
        await _query_last(db, sql, bindings)
        sql, bindings = _search_query("tasks", "organization_id=987656")
        assert "ingestion-test" in await _ids(db, sql, bindings)
    finally:
        await db.close()
