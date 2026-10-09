export const metricQueries = {
  query_task_counts_by_state: "SELECT state, count() AS count FROM task GROUP BY state",
  query_worker_counts: "SELECT status, count() AS count FROM worker GROUP BY status",
  query_task_runtime_values: "SELECT runtime FROM task WHERE runtime IS NOT NONE",
  query_tasks_by_type: "SELECT type, count() AS count FROM task WHERE type IS NOT NONE GROUP BY type",
  query_tasks_by_worker: "SELECT worker, count() AS count FROM task WHERE worker IS NOT NONE GROUP BY worker",
  query_runtime_by_type: "SELECT type, runtime FROM task WHERE runtime IS NOT NONE AND type IS NOT NONE",
  query_exceptions_by_type:
    "SELECT exception, count() AS count FROM task WHERE exception IS NOT NONE GROUP BY exception",
  query_worker_active_tasks:
    "SELECT worker, count() AS count FROM task WHERE state = 'STARTED' AND worker IS NOT NONE GROUP BY worker",
  query_worker_processed_tasks:
    "SELECT worker, count() AS count FROM task WHERE state IN ['SUCCESS', 'FAILURE', 'REVOKED', 'REJECTED'] AND worker IS NOT NONE GROUP BY worker",
} as const
