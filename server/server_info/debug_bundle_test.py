import zipfile
from pathlib import Path
from typing import Any

import pytest
from aiopath import AsyncPath
from pydantic import TypeAdapter

from server_info.debug_bundle import DebugBundleData, dump_file, dump_model, generate_bundle_file
from server_info.factories import ClientDebugInfoFactory, ServerInfoFactory, StateDumpFactory
from settings import Settings
from tasks.factories import TaskFactory
from tasks.model import Task
from ws.models import UserAgentInfo


@pytest.fixture()
def zip_file(tmp_path: Path) -> zipfile.ZipFile:
    zip_path = tmp_path / "test.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
        yield zip_file


@pytest.mark.parametrize(
    "model, model_type",
    [
        (TaskFactory.build(), Task),
        (Settings(), Settings),
        ([TaskFactory.build(), TaskFactory.build()], list[Task]),
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
    assert "nonexistent.txt" not in zip_file.namelist()
    assert "Unable to find file" in caplog.messages[-1]


@pytest.mark.asyncio
async def test_generate_bundle_file(tmp_path: Path):
    config_path = tmp_path / "config.py"
    config_path.write_text("sample content")

    log_path = tmp_path / "app.log"
    log_path.write_text("sample content")

    data = DebugBundleData(
        settings=Settings(config_path=str(config_path)),
        log_path=str(log_path),
        browser=UserAgentInfo.parse(""),
        client_info=ClientDebugInfoFactory.build(),
        connections=[],
        state_dump=StateDumpFactory.build(),
        server_info=ServerInfoFactory.build(),
    )

    content = await generate_bundle_file(data)

    with zipfile.ZipFile(content, "r") as zip_file:
        assert set(zip_file.namelist()) == {
            "config.py",
            "app.log",
            "settings.json",
            "browser.json",
            "client_info.json",
            "connections.json",
            "state.json",
            "server_info.json",
        }
