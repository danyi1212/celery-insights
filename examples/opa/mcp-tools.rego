package celery_insights

import rego.v1

default allow := false

allow if {
    input.version == 1
    not restricted
}

# The HTTP gate authorizes the endpoint; a second check authorizes each tool.
restricted if {
    input.principal.account_id == "agent"
    input.request.transport == "mcp"
    input.request.tool != "list_workers"
}
