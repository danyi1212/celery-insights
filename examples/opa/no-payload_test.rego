package celery_insights

import rego.v1

test_monitor_cannot_read_inputs if {
    not allow with input as {"version": 1, "principal": {"account_id": "monitor"}, "actions": ["task.metadata.read", "task.input.read"]}
}

test_monitor_cannot_inspect_worker_payloads if {
    not allow with input as {"version": 1, "principal": {"account_id": "monitor"}, "actions": ["worker.inspect.read"]}
}

test_monitor_can_read_metadata if {
    allow with input as {"version": 1, "principal": {"account_id": "monitor"}, "actions": ["task.metadata.read"]}
}

test_other_admin_can_read_payloads if {
    allow with input as {"version": 1, "principal": {"account_id": "admin"}, "actions": ["task.input.read"]}
}
