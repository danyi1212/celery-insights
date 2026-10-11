import { describe, expect, it } from "vitest"
import { metricQueries } from "./observation-queries"

describe("query_worker_active_tasks", () => {
  it("counts only fresh positive observations", () => {
    const query = metricQueries.query_worker_active_tasks
    expect(query).toContain("execution_active = true")
    expect(query).toContain("execution_observed_at >= last_updated")
    expect(query).toContain("execution_observed_at >= time::now() - 2m")
    expect(query).toContain("execution_observed_at <= time::now() + 2m")
  })
})
