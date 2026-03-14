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
    async def test_deletes_excess_workflows_atomically(self, mock_db):
        mock_db.query.side_effect = [
            [[{"total": 120}]],  # count query
            [[{"id": "workflow:old1", "task_count": 1}, {"id": "workflow:old2", "task_count": 2}]],  # oldest workflows
            [[{"id": "task:old1"}, {"id": "task:old2"}, {"id": "task:old3"}]],  # workflow members
            None,  # atomic delete transaction
        ]
        job = CleanupJob(task_max_count=118)
        await job._cleanup_tasks_by_count()

        assert mock_db.query.call_count == 4

        oldest_call = mock_db.query.call_args_list[1]
        assert "SELECT id, task_count FROM workflow ORDER BY last_updated ASC" in oldest_call[0][0]

        member_call = mock_db.query.call_args_list[2]
        assert "SELECT id FROM task WHERE workflow_id IN $workflow_ids" in member_call[0][0]
        assert member_call[0][1]["workflow_ids"] == ["workflow:old1", "workflow:old2"]

        delete_call = mock_db.query.call_args_list[3]
        assert "BEGIN TRANSACTION" in delete_call[0][0]
        assert "DELETE FROM event WHERE task_id IN $task_ids" in delete_call[0][0]
        assert "DELETE FROM workflow_task" in delete_call[0][0]
        assert "DELETE FROM workflow WHERE id IN $workflow_ids" in delete_call[0][0]
        assert delete_call[0][1]["workflow_ids"] == ["workflow:old1", "workflow:old2"]
        assert delete_call[0][1]["task_ids"] == ["old1", "old2", "old3"]
        assert delete_call[0][1]["task_records"] == ["task:old1", "task:old2", "task:old3"]

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
            Exception("SurrealDB down"),  # oldest workflows query fails
        ]
        job = CleanupJob(task_max_count=100)
        # Should not raise
        await job._cleanup_tasks_by_count()

    @pytest.mark.asyncio
    async def test_skips_when_no_oldest_workflows_returned(self, mock_db):
        mock_db.query.side_effect = [
            [[{"total": 200}]],  # count query
            [[]],  # oldest workflows query returns empty
        ]
        job = CleanupJob(task_max_count=100)
        await job._cleanup_tasks_by_count()
        # Only count + oldest workflow queries
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
    async def test_deletes_old_workflows_atomically(self, mock_db):
        mock_db.query.side_effect = [
            [[{"id": "workflow:ancient1"}, {"id": "workflow:ancient2"}]],  # old workflows query
            [[{"id": "task:ancient1"}, {"id": "task:ancient2"}]],  # workflow members
            None,  # atomic delete transaction
        ]
        job = CleanupJob(task_retention_hours=48)
        await job._cleanup_tasks_by_age()

        assert mock_db.query.call_count == 3

        age_call = mock_db.query.call_args_list[0]
        assert "time::now()" in age_call[0][0]
        assert age_call[0][1]["hours"] == 48
        assert "SELECT id FROM workflow" in age_call[0][0]

        members_call = mock_db.query.call_args_list[1]
        assert members_call[0][1]["workflow_ids"] == ["workflow:ancient1", "workflow:ancient2"]

        delete_call = mock_db.query.call_args_list[2]
        assert "DELETE FROM workflow WHERE id IN $workflow_ids" in delete_call[0][0]
        assert delete_call[0][1]["task_ids"] == ["ancient1", "ancient2"]
        assert delete_call[0][1]["task_records"] == ["task:ancient1", "task:ancient2"]

    @pytest.mark.asyncio
    async def test_skips_when_no_old_workflows(self, mock_db):
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
        def close_coroutine(coro):
            coro.close()
            return mocker.Mock()

        mock_create_task = mocker.patch("cleanup.asyncio.create_task", side_effect=close_coroutine)
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


class TestDeleteWorkflows:
    @pytest.fixture()
    def mock_db(self, mocker: MockerFixture):
        mock = mocker.AsyncMock()
        mocker.patch("cleanup.get_db", return_value=mock)
        return mock

    @pytest.mark.asyncio
    async def test_deletes_workflow_related_records_in_one_transaction(self, mock_db):
        mock_db.query.side_effect = [
            [[{"id": "task:abc"}, {"id": "task:def"}]],
            None,
        ]
        job = CleanupJob()
        await job._delete_workflows(["workflow:abc"])

        assert mock_db.query.call_count == 2

        member_call = mock_db.query.call_args_list[0]
        assert member_call[0][1]["workflow_ids"] == ["workflow:abc"]

        delete_call = mock_db.query.call_args_list[1]
        assert "BEGIN TRANSACTION" in delete_call[0][0]
        assert "DELETE FROM event WHERE task_id IN $task_ids" in delete_call[0][0]
        assert "DELETE FROM workflow_task" in delete_call[0][0]
        assert "DELETE FROM task WHERE id IN $task_records" in delete_call[0][0]
        assert "DELETE FROM workflow WHERE id IN $workflow_ids" in delete_call[0][0]
        assert delete_call[0][1]["task_ids"] == ["abc", "def"]
        assert delete_call[0][1]["task_records"] == ["task:abc", "task:def"]

    @pytest.mark.asyncio
    async def test_stops_if_member_lookup_fails(self, mock_db):
        mock_db.query.side_effect = [Exception("lookup failed")]

        job = CleanupJob()
        await job._delete_workflows(["workflow:abc"])

        assert mock_db.query.call_count == 1
