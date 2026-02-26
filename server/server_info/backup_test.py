import json

import pytest
from pytest_mock import MockerFixture

from server_info.backup import export_database, import_database


class TestExportDatabase:
    @pytest.fixture()
    def mock_db(self, mocker: MockerFixture):
        mock = mocker.AsyncMock()
        mocker.patch("server_info.backup.get_db", return_value=mock)
        return mock

    @pytest.mark.asyncio
    async def test_exports_all_tables(self, mock_db):
        mock_db.query.side_effect = [
            [{"id": "task:1", "state": "SUCCESS"}],
            [{"id": "event:1", "event_type": "task-succeeded"}],
            [{"id": "worker:1", "status": "online"}],
        ]

        buffer = await export_database()
        data = json.loads(buffer.read())

        assert data["version"] == 1
        assert len(data["tasks"]) == 1
        assert len(data["events"]) == 1
        assert len(data["workers"]) == 1

    @pytest.mark.asyncio
    async def test_exports_empty_database(self, mock_db):
        mock_db.query.side_effect = [[], [], []]

        buffer = await export_database()
        data = json.loads(buffer.read())

        assert data["version"] == 1
        assert data["tasks"] == []
        assert data["events"] == []
        assert data["workers"] == []

    @pytest.mark.asyncio
    async def test_raises_on_query_failure(self, mock_db):
        mock_db.query.side_effect = Exception("SurrealDB down")

        with pytest.raises(Exception, match="SurrealDB down"):
            await export_database()


class TestImportDatabase:
    @pytest.fixture()
    def mock_db(self, mocker: MockerFixture):
        mock = mocker.AsyncMock()
        mocker.patch("server_info.backup.get_db", return_value=mock)
        return mock

    @pytest.mark.asyncio
    async def test_imports_all_record_types(self, mock_db):
        data = {
            "version": 1,
            "tasks": [{"id": "task:1", "state": "SUCCESS", "last_updated": "2025-01-01T00:00:00Z"}],
            "events": [{"id": "event:1", "event_type": "task-succeeded"}],
            "workers": [{"id": "worker:1", "status": "online"}],
        }

        result = await import_database(data)

        assert result == {"tasks": 1, "events": 1, "workers": 1}
        # Should have cleared tables first
        clear_call = mock_db.query.call_args_list[0]
        assert "DELETE FROM task" in clear_call[0][0]

    @pytest.mark.asyncio
    async def test_clears_existing_data_before_import(self, mock_db):
        data = {"version": 1, "tasks": [], "events": [], "workers": []}

        await import_database(data)

        first_call = mock_db.query.call_args_list[0]
        assert "DELETE FROM task" in first_call[0][0]
        assert "DELETE FROM event" in first_call[0][0]
        assert "DELETE FROM worker" in first_call[0][0]

    @pytest.mark.asyncio
    async def test_rejects_unsupported_version(self, mock_db):  # noqa: ARG002
        data = {"version": 999, "tasks": [], "events": [], "workers": []}

        with pytest.raises(ValueError, match="Unsupported backup version"):
            await import_database(data)

    @pytest.mark.asyncio
    async def test_handles_empty_import(self, mock_db):  # noqa: ARG002
        data = {"version": 1, "tasks": [], "events": [], "workers": []}

        result = await import_database(data)

        assert result == {"tasks": 0, "events": 0, "workers": 0}

    @pytest.mark.asyncio
    async def test_skips_records_without_id(self, mock_db):  # noqa: ARG002
        data = {
            "version": 1,
            "tasks": [{"state": "SUCCESS"}],  # no id
            "events": [],
            "workers": [],
        }

        result = await import_database(data)

        assert result["tasks"] == 0

    @pytest.mark.asyncio
    async def test_extracts_plain_id_from_record_id(self, mock_db):
        data = {
            "version": 1,
            "tasks": [{"id": "task:abc-123", "state": "SUCCESS"}],
            "events": [],
            "workers": [],
        }

        await import_database(data)

        # Find the CREATE call for the task (after the DELETE call)
        create_calls = [c for c in mock_db.query.call_args_list if "CREATE" in str(c)]
        assert len(create_calls) == 1
        # Bindings are passed as second positional arg (dict)
        bindings = create_calls[0][0][1]
        assert bindings["id"] == "abc-123"

    @pytest.mark.asyncio
    async def test_continues_on_individual_record_failure(self, mock_db):
        data = {
            "version": 1,
            "tasks": [
                {"id": "task:1", "state": "SUCCESS"},
                {"id": "task:2", "state": "FAILURE"},
            ],
            "events": [],
            "workers": [],
        }

        # First call is DELETE, then first CREATE fails, second succeeds
        mock_db.query.side_effect = [None, RuntimeError("insert error"), None]

        result = await import_database(data)

        # First task failed, second succeeded
        assert result["tasks"] == 1
