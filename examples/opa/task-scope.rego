package celery_insights

import rego.v1

default allow := false

# Each configured selector intersects; omitted selectors are unrestricted.
# Field groups are removed before any search, aggregation or export.
allow := {"allow": true, "scope": {
    "task_types": ["reports.render"],
    "task_workers": ["celery@reports"],
    "worker_hostnames": ["celery@reports"],
    "deny_fields": ["task.input.read", "task.result.read", "task.failure.read", "event.raw.read", "worker.inspect.read"],
}} if {
    input.version == 1
    input.principal.account_id == "monitor"
}

allow := true if {
    input.version == 1
    input.principal.account_id != "monitor"
}
