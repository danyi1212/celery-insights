package celery_insights

import rego.v1

test_agent_can_list_workers if {
    allow with input as {"version": 1, "principal": {"account_id": "agent"}, "request": {"transport": "mcp", "tool": "list_workers"}}
}

test_agent_cannot_inspect_tasks if {
    not allow with input as {"version": 1, "principal": {"account_id": "agent"}, "request": {"transport": "mcp", "tool": "inspect_task"}}
}

test_agent_can_reach_http_endpoint if {
    allow with input as {"version": 1, "principal": {"account_id": "agent"}, "request": {"transport": "http", "path": "/mcp"}}
}

test_other_admin_can_inspect_tasks if {
    allow with input as {"version": 1, "principal": {"account_id": "admin"}, "request": {"transport": "mcp", "tool": "inspect_task"}}
}
