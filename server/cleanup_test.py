import asyncio

import pytest
from pytest_mock import MockerFixture

from cleanup import CleanupJob


class TestCleanupTasksByCount:
    @pytest.fixture()
    def mock_db(self, mocker: MockerFixture):
        mock = mocker.AsyncMock()
        mocker.patch("cleanup.get_db", return_value=mock)
        return mock

    @pytest.mark.asyncio
    async def test_skips_when_task_max_count_is_none(self, mock_db):
        job = CleanupJob(task_max_count=None)
        await job._cleanup_tasks_by_count()
        mock_db.query.assert_not_called()

    @pytest.mark.asyncio
    async def test_skips_when_count_under_limit(self, mock_db):
        mock_db.query.return_value = [[{"total": 50}]]
        job = CleanupJob(task_max_count=100)
        await job._cleanup_tasks_by_count()
        # Only the count query should be called
        assert mock_db.query.call_count == 1

    @pytest.mark.asyncio
    async def test_deletes_excess_tasks_and_events(self, mock_db):
        mock_db.query.side_effect = [
            [[{"total": 120}]],  # count query
            [[{"id": "task:old1"}, {"id": "task:old2"}]],  # oldest tasks query
            None,  # delete events
            None,  # delete tasks
        ]
        job = CleanupJob(task_max_count=118)
        await job._cleanup_tasks_by_count()

        assert mock_db.query.call_count == 4

        # Verify oldest tasks query has correct limit
        oldest_call = mock_db.query.call_args_list[1]
        assert "ORDER BY last_updated ASC LIMIT" in oldest_call[0][0]
        assert oldest_call[0][1]["limit"] == 2

        # Verify event deletion with task ID strings
        event_delete_call = mock_db.query.call_args_list[2]
        assert "DELETE FROM event" in event_delete_call[0][0]
        assert event_delete_call[0][1]["task_ids"] == ["old1", "old2"]

        # Verify task deletion with full record IDs
        task_delete_call = mock_db.query.call_args_list[3]
        assert "DELETE FROM task" in task_delete_call[0][0]
        assert task_delete_call[0][1]["task_ids"] == ["task:old1", "task:old2"]

    @pytest.mark.asyncio
    async def test_handles_count_query_error(self, mock_db):
        mock_db.query.side_effect = Exception("SurrealDB down")
        job = CleanupJob(task_max_count=100)
        # Should not raise
        await job._cleanup_tasks_by_count()

    @pytest.mark.asyncio
    async def test_handles_empty_count_result(self, mock_db):
        mock_db.query.return_value = [[]]
        job = CleanupJob(task_max_count=100)
        await job._cleanup_tasks_by_count()
        assert mock_db.query.call_count == 1

    @pytest.mark.asyncio
    async def test_handles_oldest_query_error(self, mock_db):
        mock_db.query.side_effect = [
            [[{"total": 200}]],  # count query
            Exception("SurrealDB down"),  # oldest tasks query fails
        ]
        job = CleanupJob(task_max_count=100)
        # Should not raise
        await job._cleanup_tasks_by_count()

    @pytest.mark.asyncio
    async def test_skips_when_no_oldest_tasks_returned(self, mock_db):
        mock_db.query.side_effect = [
            [[{"total": 200}]],  # count query
            [[]],  # oldest tasks query returns empty
        ]
        job = CleanupJob(task_max_count=100)
        await job._cleanup_tasks_by_count()
        # Only count + oldest queries
        assert mock_db.query.call_count == 2


class TestCleanupTasksByAge:
    @pytest.fixture()
    def mock_db(self, mocker: MockerFixture):
        mock = mocker.AsyncMock()
        mocker.patch("cleanup.get_db", return_value=mock)
        return mock

    @pytest.mark.asyncio
    async def test_skips_when_retention_hours_is_none(self, mock_db):
        job = CleanupJob(task_retention_hours=None)
        await job._cleanup_tasks_by_age()
        mock_db.query.assert_not_called()

    @pytest.mark.asyncio
    async def test_deletes_old_tasks_and_events(self, mock_db):
        mock_db.query.side_effect = [
            [[{"id": "task:ancient1"}, {"id": "task:ancient2"}]],  # old tasks query
            None,  # delete events
            None,  # delete tasks
        ]
        job = CleanupJob(task_retention_hours=48)
        await job._cleanup_tasks_by_age()

        assert mock_db.query.call_count == 3

        # Verify age query uses correct hours
        age_call = mock_db.query.call_args_list[0]
        assert "time::now()" in age_call[0][0]
        assert age_call[0][1]["hours"] == 48

        # Verify event deletion
        event_call = mock_db.query.call_args_list[1]
        assert "DELETE FROM event" in event_call[0][0]
        assert event_call[0][1]["task_ids"] == ["ancient1", "ancient2"]

        # Verify task deletion
        task_call = mock_db.query.call_args_list[2]
        assert "DELETE FROM task" in task_call[0][0]
        assert task_call[0][1]["task_ids"] == ["task:ancient1", "task:ancient2"]

    @pytest.mark.asyncio
    async def test_skips_when_no_old_tasks(self, mock_db):
        mock_db.query.return_value = [[]]
        job = CleanupJob(task_retention_hours=24)
        await job._cleanup_tasks_by_age()
        assert mock_db.query.call_count == 1

    @pytest.mark.asyncio
    async def test_handles_query_error(self, mock_db):
        mock_db.query.side_effect = Exception("SurrealDB down")
        job = CleanupJob(task_retention_hours=24)
        # Should not raise
        await job._cleanup_tasks_by_age()


class TestCleanupDeadWorkers:
    @pytest.fixture()
    def mock_db(self, mocker: MockerFixture):
        mock = mocker.AsyncMock()
        mocker.patch("cleanup.get_db", return_value=mock)
        return mock

    @pytest.mark.asyncio
    async def test_skips_when_retention_hours_is_none(self, mock_db):
        job = CleanupJob(dead_worker_retention_hours=None)
        await job._cleanup_dead_workers()
        mock_db.query.assert_not_called()

    @pytest.mark.asyncio
    async def test_deletes_old_offline_workers(self, mock_db):
        mock_db.query.return_value = [[{"id": "worker:dead@host", "status": "offline"}]]
        job = CleanupJob(dead_worker_retention_hours=24)
        await job._cleanup_dead_workers()

        assert mock_db.query.call_count == 1
        call = mock_db.query.call_args_list[0]
        query_str = call[0][0]
        params = call[0][1]
        assert "DELETE FROM worker" in query_str
        assert "status = 'offline'" in query_str
        assert "RETURN BEFORE" in query_str
        assert params["hours"] == 24

    @pytest.mark.asyncio
    async def test_handles_no_dead_workers(self, mock_db):
        mock_db.query.return_value = [[]]
        job = CleanupJob(dead_worker_retention_hours=24)
        await job._cleanup_dead_workers()
        assert mock_db.query.call_count == 1

    @pytest.mark.asyncio
    async def test_handles_query_error(self, mock_db):
        mock_db.query.side_effect = Exception("SurrealDB down")
        job = CleanupJob(dead_worker_retention_hours=24)
        # Should not raise
        await job._cleanup_dead_workers()


class TestCleanupJob:
    @pytest.fixture()
    def mock_db(self, mocker: MockerFixture):
        mock = mocker.AsyncMock()
        mocker.patch("cleanup.get_db", return_value=mock)
        return mock

    def test_start_creates_task(self, mocker: MockerFixture):
        mock_create_task = mocker.patch("cleanup.asyncio.create_task")
        job = CleanupJob()
        job.start()
        mock_create_task.assert_called_once()

    @pytest.mark.asyncio
    async def test_stop_sets_event_and_cancels(self):
        job = CleanupJob()
        # Create a real task that blocks until cancelled
        job._task = asyncio.create_task(asyncio.sleep(999))
        await job.stop()

        assert job._stop_event.is_set()
        assert job._task.cancelled()

    @pytest.mark.asyncio
    async def test_cleanup_loop_stops_on_event(self, mock_db):
        mock_db.query.return_value = [[]]

        job = CleanupJob(
            interval_seconds=1,
            task_max_count=None,
            task_retention_hours=None,
            dead_worker_retention_hours=None,
        )
        job._stop_event.set()
        # Should exit after one iteration since stop event is set
        await job._cleanup_loop()

    @pytest.mark.asyncio
    async def test_run_cleanup_calls_all_policies(self, mock_db, mocker: MockerFixture):  # noqa: ARG002
        job = CleanupJob()
        mock_count = mocker.patch.object(job, "_cleanup_tasks_by_count", new_callable=mocker.AsyncMock)
        mock_age = mocker.patch.object(job, "_cleanup_tasks_by_age", new_callable=mocker.AsyncMock)
        mock_workers = mocker.patch.object(job, "_cleanup_dead_workers", new_callable=mocker.AsyncMock)

        await job._run_cleanup()

        mock_count.assert_awaited_once()
        mock_age.assert_awaited_once()
        mock_workers.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_cleanup_loop_continues_after_error(self, mock_db, mocker: MockerFixture):  # noqa: ARG002
        """Verify the loop doesn't crash when a cleanup cycle raises."""
        job = CleanupJob(interval_seconds=0)
        call_count = 0

        async def failing_then_stopping():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RuntimeError("Transient failure")
            # Second call succeeds, then stop
            job._stop_event.set()

        mocker.patch.object(job, "_run_cleanup", side_effect=failing_then_stopping)

        await job._cleanup_loop()
        assert call_count == 2


class TestDeleteTasksAndEvents:
    @pytest.fixture()
    def mock_db(self, mocker: MockerFixture):
        mock = mocker.AsyncMock()
        mocker.patch("cleanup.get_db", return_value=mock)
        return mock

    @pytest.mark.asyncio
    async def test_deletes_events_then_tasks(self, mock_db):
        job = CleanupJob()
        await job._delete_tasks_and_events(["task:abc", "task:def"])

        assert mock_db.query.call_count == 2

        # Events deleted first
        event_call = mock_db.query.call_args_list[0]
        assert "DELETE FROM event" in event_call[0][0]
        assert event_call[0][1]["task_ids"] == ["abc", "def"]

        # Then tasks
        task_call = mock_db.query.call_args_list[1]
        assert "DELETE FROM task" in task_call[0][0]
        assert task_call[0][1]["task_ids"] == ["task:abc", "task:def"]

    @pytest.mark.asyncio
    async def test_continues_task_deletion_if_event_deletion_fails(self, mock_db):
        mock_db.query.side_effect = [Exception("Event delete failed"), None]

        job = CleanupJob()
        await job._delete_tasks_and_events(["task:abc"])

        # Should still try to delete tasks even if events failed
        assert mock_db.query.call_count == 2
