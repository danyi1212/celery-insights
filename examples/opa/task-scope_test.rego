package celery_insights

import rego.v1

test_monitor_has_intersecting_task_constraints if {
    decision := allow with input as {"version": 1, "principal": {"account_id": "monitor"}}
    decision.allow
    decision.scope.task_types == ["reports.render"]
    decision.scope.task_workers == ["celery@reports"]
    "task.input.read" in decision.scope.deny_fields
}

test_other_accounts_keep_role_grants if {
    allow == true with input as {"version": 1, "principal": {"account_id": "admin"}}
}

test_unknown_contract_versions_are_denied if {
    allow == false with input as {"version": 2, "principal": {"account_id": "monitor"}}
}
