package celery_insights

import rego.v1

default allow := false

allow := true if {
    input.version == 1
    input.principal.account_id != "policy-admin"
}

allow := object.get(data.fixture, "result", true) if {
    input.version == 1
    input.principal.account_id == "policy-admin"
    not blocked
}

blocked if {
    input.principal.account_id == "policy-admin"
    object.get(data.fixture, "deny_all", false)
}

blocked if {
    input.principal.account_id == "policy-admin"
    some action in input.actions
    action in object.get(data.fixture, "deny_actions", [])
}

blocked if {
    input.principal.account_id == "policy-admin"
    input.request.transport == "mcp"
    input.request.tool in object.get(data.fixture, "deny_tools", [])
}

blocked if {
    input.principal.account_id == "policy-admin"
    input.request.transport == "websocket"
    object.get(data.fixture, "deny_websocket", false)
}
