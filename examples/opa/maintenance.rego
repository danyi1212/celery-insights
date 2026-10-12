package celery_insights

import rego.v1

default allow := false

# Preserve role grants, but prevent a monitoring account from changing state.
allow if {
    input.version == 1
    not restricted
}

restricted if {
    input.principal.account_id == "monitor"
    some action in input.actions
    action in {"backup.import", "history.clear", "retention.update", "cleanup.run"}
}
