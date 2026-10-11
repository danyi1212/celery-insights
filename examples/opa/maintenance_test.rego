package celery_insights

import rego.v1

test_monitor_cannot_clear if {
    not allow with input as {"version": 1, "principal": {"account_id": "monitor"}, "actions": ["history.clear"]}
}

test_monitor_can_read_metrics if {
    allow with input as {"version": 1, "principal": {"account_id": "monitor"}, "actions": ["metrics.read"]}
}

test_other_admin_can_clear if {
    allow with input as {"version": 1, "principal": {"account_id": "admin"}, "actions": ["history.clear"]}
}

test_unknown_version_denied if {
    not allow with input as {"version": 2, "principal": {"account_id": "admin"}, "actions": []}
}
