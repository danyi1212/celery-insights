package celery_insights

import rego.v1

default allow := false

# Metrics and permitted metadata remain available. Broad RPC/MCP/exports are denied
# because their required permission set includes the blocked payload permissions.
allow if {
    input.version == 1
    not restricted
}

restricted if {
    input.principal.account_id == "monitor"
    some action in input.actions
    action in {"task.input.read", "task.result.read", "task.failure.read", "event.raw.read", "worker.inspect.read"}
}
