import { taskScoped, restricted, type ReadScope } from "../security/read-scope"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { HttpError } from "../http-error"
import type { Surreal } from "surrealdb"
import { createLogger } from "../logger"
import { Cursors, Queries, Results, ToolError, schemas, type ToolName, type Row, type Mode } from "./common"
import { WorkflowTools } from "./workflows"
import { TaskTools } from "./tasks"
import { WorkerTools } from "./workers"
import { outputSchemas } from "./output-schemas"

const logger = createLogger("mcp")
const descriptions: Record<ToolName, string> = {
  search_workflows:
    "Find recently invoked tasks as compact workflow candidates. Search by task-name/worker fragments and relative time; status filters whole-workflow progress, has_errors includes recovered errors. Filters intersect; name and worker must match the same task. within defaults to 1h, or all for retained history. Returns workflow handles and representative task evidence, never every task ID. Continue using only the cursor. Live pagination is not a frozen snapshot.",
  inspect_workflow:
    "Inspect a discovered workflow. overview summarizes errors/running work and includes all members only for small workflows. tasks pages members with state and parent references; parent_task_id selects direct observed children, task_name selects a name fragment. task_names pages all grouped names. Counts describe retained observations, not planned canvas membership. Continue using workflow_id and cursor only; live membership can change.",
  inspect_task:
    "Inspect one task invocation. overview includes timing, relationships and bounded input/output/error previews. input, output and error retrieve stored text in chunks; history pages observed events. Representations are text, not guaranteed JSON. Source-truncated data cannot be recovered. Continue using task_id and cursor only; missing fields do not imply empty input or successful null output.",
  list_workers:
    "Discover worker hostnames, availability, consumed queues, capabilities and compact running/reserved/scheduled counts. task_name filters registered capabilities, not current activity. Missing inspection counts are unknown rather than zero. Continue using cursor only; capability searches may return empty pages with a continuation while scanning legacy snapshots.",
  inspect_worker:
    "Read a stored worker snapshot by exact hostname. overview includes bounded activity, queues and concurrency; activity, registered and queues provide paginated detail. Task-name fragments apply to activity or registered sections. Sections can have different capture times; this tool never polls Celery. Continue using hostname and cursor only. Restart if the underlying inspection changes.",
}
export interface McpOptions {
  db: Pick<Surreal, "query">
  publicOrigin?: string
  cursorSecret: string
  mode: () => Mode
  allowedHosts?: string[]
  readScope?: ReadScope
  authorize?: (
    request: Request,
    tool: ToolName,
  ) => Promise<void | { db: Pick<Surreal, "query">; cursorSecret: string; readScope: ReadScope }>
  now?: () => number
}
export class McpTools {
  private readonly cursors: Cursors
  private readonly now: () => number
  constructor(private readonly options: McpOptions) {
    this.now = options.now ?? Date.now
    this.cursors = new Cursors(options.cursorSecret, this.now)
  }
  async call(tool: ToolName, input: unknown): Promise<Row> {
    const parsed = schemas[tool].safeParse(input)
    if (!parsed.success)
      throw new ToolError(
        "invalid_arguments",
        parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
      )
    const { scope, position } = this.cursors.resolve(tool, parsed.data)
    const read = this.options.readScope
    if (read) {
      if (taskScoped(read) && ["search_workflows", "inspect_workflow"].includes(tool))
        throw new ToolError("access_denied", "Workflow inspection requires unrestricted task visibility.")
      if (tool === "inspect_worker" && restricted(read) && scope.section && scope.section !== "overview")
        throw new ToolError("access_denied", "Worker inspection details are unavailable for this scope.")
      const fields = {
        input: "task.input.read",
        output: "task.result.read",
        error: "task.failure.read",
        history: "event.raw.read",
      } as const
      if (
        tool === "inspect_task" &&
        typeof scope.section === "string" &&
        scope.section in fields &&
        read.deny_fields.includes(fields[scope.section as keyof typeof fields])
      )
        throw new ToolError("access_denied", "Payload section is denied by policy.")
    }
    const queries = new Queries(this.options.db)
    const results = new Results(tool, scope, this.cursors, this.options.mode(), this.now)
    const now = this.now()
    switch (tool) {
      case "search_workflows":
        return new WorkflowTools(queries, results, now).search(position)
      case "inspect_workflow":
        return new WorkflowTools(queries, results, now).inspect(position)
      case "inspect_task":
        return new TaskTools(queries, results, now).inspect(position)
      case "list_workers":
        return new WorkerTools(queries, results, now).list(position)
      case "inspect_worker":
        return new WorkerTools(queries, results, now).inspect(position)
    }
  }
}
export const createMcpHandler = (options: McpOptions): ((request: Request) => Promise<Response>) => {
  const tools = new McpTools(options)
  const allowedHosts = options.allowedHosts ?? ["localhost", "127.0.0.1", "[::1]"]
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    if (!allowedHosts.includes(url.hostname))
      return Response.json({ error: "Host is not allowed for MCP; configure MCP_ALLOWED_HOSTS." }, { status: 403 })
    const origin = request.headers.get("origin")
    if (origin && origin !== (options.publicOrigin ?? url.origin))
      return Response.json({ error: "Origin is not allowed." }, { status: 403 })

    if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } })
    const server = new McpServer({ name: "celery-insights", version: "0.2.0" })
    for (const tool of Object.keys(schemas) as ToolName[]) {
      server.registerTool(
        tool,
        {
          description: descriptions[tool],
          inputSchema: schemas[tool],
          outputSchema: outputSchemas[tool],
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        },
        async (input: Row) => {
          try {
            const access = await options.authorize?.(request, tool)
            const result = await (access ? new McpTools({ ...options, ...access }) : tools).call(tool, input)
            return { content: [{ type: "text" as const, text: JSON.stringify(result) }], structuredContent: result }
          } catch (error) {
            const failure =
              error instanceof HttpError
                ? new ToolError(
                    error.status === 403 ? "access_denied" : "unavailable",
                    error.status === 403 ? "Access denied by policy." : "Authorization policy unavailable.",
                  )
                : error instanceof ToolError
                  ? error
                  : new ToolError("unavailable", "Inspection failed; no conclusion about the cluster can be drawn.")
            logger.warn(`Tool ${tool} failed (${failure.code})`)
            return {
              isError: true,
              content: [
                { type: "text" as const, text: JSON.stringify({ code: failure.code, message: failure.message }) },
              ],
            }
          }
        },
      )
    }
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
      maxRequestBodySize: 32 * 1024,
    })
    try {
      await server.connect(transport)
      const response = await transport.handleRequest(request)
      // JSON response mode permits cleanup after buffering, without closing a live SSE stream.
      return new Response(await response.arrayBuffer(), { status: response.status, headers: response.headers })
    } finally {
      await server.close()
    }
  }
}
