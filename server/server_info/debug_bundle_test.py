import json
import zipfile
from collections.abc import Generator
from pathlib import Path
from typing import Any

import pytest
from aiopath import AsyncPath
from pydantic import TypeAdapter
from pytest_mock import MockerFixture

from server_info.debug_bundle import (
    DebugBundleData,
    _query_state_dump,
    dump_file,
    dump_json,
    dump_model,
    generate_bundle_file,
)
from server_info.factories import ClientDebugInfoFactory, ServerInfoFactory, StateDumpFactory
from settings import Settings


@pytest.fixture()
def zip_file(tmp_path: Path) -> Generator[zipfile.ZipFile, None, None]:
    zip_path = tmp_path / "test.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
        yield zip_file


@pytest.mark.parametrize(
    "model, model_type",
    [
        (Settings(), Settings),
    ],
)
def test_dump_model(zip_file: zipfile.ZipFile, model: Any, model_type: type, filename="test.json"):
    dump_model(zip_file, filename, model)

    assert filename in zip_file.namelist(), f"File {filename!r} does not exist in the Zip file."

    actual_content = zip_file.read(filename)
    assert actual_content

    adapter = TypeAdapter(model_type)
    actual_object = adapter.validate_json(actual_content)
    assert actual_object == model


def test_dump_model_non_serializable_type(zip_file: zipfile.ZipFile, caplog: pytest.LogCaptureFixture):
    class UnsupportedModel:
        pass

    model = UnsupportedModel()

    dump_model(zip_file, "unsupported_model.json", model)

    assert "unsupported_model.json" not in zip_file.namelist()
    assert "Failed to dump object" in caplog.messages[-1]
    assert "unknown type" in caplog.messages[-1]


@pytest.mark.asyncio
@pytest.mark.parametrize("encoding", ["utf-8"])
async def test_dump_file(zip_file: zipfile.ZipFile, tmp_path: Path, encoding: str):
    test_file = AsyncPath(tmp_path) / "test.txt"
    await test_file.write_text("sample content", encoding=encoding)

    await dump_file(zip_file, "test.txt", test_file)
    assert "test.txt" in zip_file.namelist()

    actual_content = zip_file.read("test.txt").decode(encoding)
    assert actual_content == "sample content"


@pytest.mark.asyncio
async def test_dump_file_nonexistent_path(zip_file: zipfile.ZipFile, tmp_path: Path, caplog: pytest.LogCaptureFixture):
    non_existent_file = AsyncPath(tmp_path) / "nonexistent.txt"

    await dump_file(zip_file, "nonexistent.txt", non_existent_file)
    assert "nonexistent.txt" not in zip_file.namelist()
    assert "Unable to find file" in caplog.messages[-1]


@pytest.mark.asyncio
async def test_dump_file_not_a_file(zip_file: zipfile.ZipFile, tmp_path: Path, caplog: pytest.LogCaptureFixture):
    not_a_file = AsyncPath(tmp_path) / "some_folder"
    await not_a_file.mkdir(exist_ok=True, parents=True)

    await dump_file(zip_file, "some_folder", not_a_file)
    assert "some_folder" not in zip_file.namelist()
    assert "Unable to find file" in caplog.messages[-1]


@pytest.mark.asyncio
async def test_generate_bundle_file(tmp_path: Path):
    config_path = tmp_path / "config.py"
    config_path.write_text("sample content")

    log_path = tmp_path / "app.log"
    log_path.write_text("sample content")

    data = DebugBundleData(
        settings=Settings(config_file=str(config_path)),
        log_path=str(log_path),
        client_info=ClientDebugInfoFactory.build(),
        state_dump=StateDumpFactory.build(),
        server_info=ServerInfoFactory.build(),
    )

    content = await generate_bundle_file(data)

    with zipfile.ZipFile(content, "r") as zip_file:
        assert set(zip_file.namelist()) == {
            "config.py",
            "app.log",
            "settings.json",
            "client_info.json",
            "state.json",
            "server_info.json",
        }


def test_dump_json(zip_file: zipfile.ZipFile):
    data = {"tasks": [{"id": "task:1", "state": "SUCCESS"}]}
    dump_json(zip_file, "test.json", data)

    assert "test.json" in zip_file.namelist()
    content = json.loads(zip_file.read("test.json"))
    assert content == data


def test_dump_json_with_datetime(zip_file: zipfile.ZipFile):
    from datetime import datetime

    data = {"timestamp": datetime(2024, 1, 1)}
    dump_json(zip_file, "dates.json", data)

    assert "dates.json" in zip_file.namelist()
    content = json.loads(zip_file.read("dates.json"))
    assert content["timestamp"] == "2024-01-01 00:00:00"


class TestQueryStateDump:
    @pytest.fixture()
    def mock_db(self, mocker: MockerFixture):
        mock = mocker.AsyncMock()
        mocker.patch("server_info.debug_bundle.get_db", return_value=mock)
        return mock

    @pytest.mark.asyncio
    async def test_returns_tasks_and_workers(self, mock_db):
        mock_db.query.side_effect = [
            [{"id": "task:1", "state": "SUCCESS"}],
            [{"id": "worker:w1", "status": "online"}],
        ]

        dump = await _query_state_dump()

        assert len(dump.tasks) == 1
        assert dump.tasks[0]["id"] == "task:1"
        assert len(dump.workers) == 1
        assert dump.workers[0]["id"] == "worker:w1"

    @pytest.mark.asyncio
    async def test_returns_empty_on_error(self, mock_db):
        mock_db.query.side_effect = Exception("SurrealDB down")

        dump = await _query_state_dump()

        assert dump.tasks == []
        assert dump.workers == []

    @pytest.mark.asyncio
    async def test_returns_empty_on_empty_results(self, mock_db):
        mock_db.query.side_effect = [[], []]

        dump = await _query_state_dump()

        assert dump.tasks == []
        assert dump.workers == []
