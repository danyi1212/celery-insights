"""Validate out-of-order parent updates against the production schema."""

import asyncio
import os
import shutil
import socket
import subprocess
from pathlib import Path
from uuid import uuid4

import pytest
import httpx
from surrealdb import AsyncSurreal

from events.ingester import build_children_update, build_task_upsert


@pytest.mark.asyncio
@pytest.mark.parametrize("root_id", ["workflow-root", None])
async def test_child_before_parent_creates_valid_placeholder(root_id: str | None) -> None:
    url = os.environ.get("INGESTION_TEST_URL")
    process = None
    if not url:
        if shutil.which("surreal") is None:
            pytest.skip("Native SurrealDB CLI or INGESTION_TEST_URL required")
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        process = subprocess.Popen(
            ["surreal", "start", "--bind", f"127.0.0.1:{port}", "--user", "root", "--pass", "root", "memory"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        url = f"ws://127.0.0.1:{port}/rpc"
        async with httpx.AsyncClient() as http:
            for _ in range(100):
                try:
                    if (await http.get(f"http://127.0.0.1:{port}/health")).is_success:
                        break
                except httpx.ConnectError:
                    pass
                await asyncio.sleep(0.1)
            else:
                process.terminate()
                process.wait(timeout=5)
                pytest.fail("SurrealDB did not start")
    database = f"children_{uuid4().hex}"
    try:
        async with AsyncSurreal(url) as db:
            await db.signin({"username": "root", "password": "root"})
            await db.use("integration", database)
            try:
                schema_source = Path(__file__).resolve().parents[2] / "runtime/surreal-schema.ts"
                schema = schema_source.read_text().split("export const CORE_SCHEMA = `", 1)[1].split("`", 1)[0]
                await db.query(schema)

                async def execute(sql: str, params: dict) -> None:
                    response = await db.query_raw(sql, params)
                    errors = [item["result"] for item in response["result"] if item.get("status") == "ERR"]
                    assert not errors, errors

                async def read_parent() -> dict:
                    records = await db.query("SELECT * FROM task:parent")
                    assert isinstance(records, list) and len(records) == 1
                    assert isinstance(records[0], dict)
                    return records[0]

                event = {"type": "task-received", "uuid": "child", "parent_id": "parent", "root_id": root_id}
                await execute(*build_children_update(event, 0))
                parent = await read_parent()
                assert parent["workflow_id"] == (root_id or "parent")
                assert parent["state"] == "PENDING"
                assert parent["children"] == ["child"]

                # A later observation must enrich the placeholder without losing its children.
                await execute(
                    *build_task_upsert(
                        {
                            "type": "task-sent",
                            "uuid": "parent",
                            "root_id": "actual-root",
                            "timestamp": 1700000000.0,
                            "name": "reports.parent",
                        },
                        1,
                    )
                )
                # Child metadata must not overwrite an already established parent workflow.
                await execute(*build_children_update(event | {"uuid": "sibling", "root_id": "different-root"}, 2))
                await execute(*build_children_update(event, 3))
                parent = await read_parent()
                assert parent["workflow_id"] == "actual-root"
                assert parent["type"] == "reports.parent"
                assert set(parent["children"]) == {"child", "sibling"}
            finally:
                await db.query(f"REMOVE DATABASE {database}")
    finally:
        if process:
            process.terminate()
            process.wait(timeout=5)
