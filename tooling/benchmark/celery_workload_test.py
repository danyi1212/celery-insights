"""Independent formula and compatibility checks for the real-worker fixture."""


def test_real_worker_fixture_result_and_monitor_queues(monkeypatch):
    monkeypatch.setenv("BROKER_URL", "amqp://benchmark:benchmark@localhost/")
    monkeypatch.setenv("RESULT_BACKEND", "redis://localhost/0")
    from tooling.benchmark.celery_workload import app, cpu_work

    assert cpu_work.run(7, 10) == 292
    assert cpu_work.run(0, 1) == 0
    assert app.conf.control_queue_exclusive is True
    assert app.conf.event_queue_exclusive is True
    assert app.conf.task_track_started is True
