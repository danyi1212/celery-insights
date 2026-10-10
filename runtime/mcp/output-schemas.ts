import { z } from "zod"
import type { ToolName } from "./common"

const nullableText = z.string().nullable()
const row = z.record(z.string(), z.unknown())
const meta = z.object({
  read_at: z.string(),
  mode: z.enum(["live", "snapshot", "ingestion_disabled"]),
  warnings: z.array(z.string()),
})
const page = z.object({
  returned: z.number().int().nonnegative(),
  total: z.number().int().nonnegative().nullable(),
  has_more: z.boolean(),
  next_cursor: nullableText,
})
const counts = z.object({
  total: z.number().int().nonnegative(),
  by_name: z.array(z.object({ name: nullableText, count: z.number().int().positive() })),
  omitted_name_count: z.number().int().nonnegative(),
})
const workflow = z
  .object({
    workflow_id: z.string(),
    root_task_name: nullableText,
    status: z.enum(["running", "finished"]).nullable(),
    has_errors: z.boolean().nullable(),
    error_task_count: z.number().int().nonnegative().nullable(),
    task_counts: counts,
  })
  .passthrough()
const task = z
  .object({
    task_id: z.string(),
    name: nullableText,
    state: z.string(),
    worker: nullableText,
    execution_status: z.enum(["active", "not_active", "unknown"]).nullable().optional(),
    execution_observed_at: nullableText.optional(),
    execution_active_at: nullableText.optional(),
    workflow_id: nullableText,
  })
  .passthrough()
const worker = z.object({ hostname: z.string(), status: nullableText, last_updated: z.unknown() }).passthrough()

export const outputSchemas: Record<ToolName, z.ZodObject> = {
  search_workflows: z
    .object({ meta, effective_filters: row, workflows: z.array(workflow), page, diagnostics: z.array(row) })
    .passthrough(),
  inspect_workflow: z
    .object({
      meta,
      workflow,
      task_names: z.array(row).optional(),
      tasks: z.array(row).optional(),
      page: page.optional(),
    })
    .passthrough(),
  inspect_task: z
    .object({
      meta,
      task,
      fields: row.optional(),
      events: z.array(row).optional(),
      page: page.optional(),
      has_more: z.boolean().optional(),
      next_cursor: nullableText.optional(),
    })
    .passthrough(),
  list_workers: z
    .object({ meta, effective_filters: row, workers: z.array(worker), page, diagnostics: z.array(row) })
    .passthrough(),
  inspect_worker: z.object({ meta, worker, inspection: row, page: page.optional() }).passthrough(),
}
