import { describe, expect, it } from "vitest"
import { schemas } from "./common"

describe("compiled MCP argument validation", () => {
  it("keeps selector normalization", () => {
    expect(schemas.inspect_task.parse({ task_id: "  task-123  " })).toEqual({ task_id: "task-123" })
    expect(schemas.search_workflows.parse({ task_name: "  tasks.add  " })).toEqual({ task_name: "tasks.add" })
  })

  it("rejects invalid arguments before reaching a tool", () => {
    expect(schemas.inspect_task.safeParse({ task_id: "  " }).success).toBe(false)
    expect(schemas.inspect_task.safeParse({ task_id: "task-123", unexpected: true }).success).toBe(false)
    expect(schemas.search_workflows.safeParse({ limit: 21 }).success).toBe(false)
    expect(schemas.search_workflows.safeParse({ has_errors: "false" }).success).toBe(false)
    expect(schemas.inspect_workflow.safeParse({ workflow_id: "root", view: "unknown" }).success).toBe(false)
    expect(schemas.list_workers.safeParse({ status: "unknown" }).success).toBe(false)
    expect(schemas.inspect_worker.safeParse({ hostname: "celery@host", limit: -1 }).success).toBe(false)
  })
})
