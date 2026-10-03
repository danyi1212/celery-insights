import DocsPage from "@components/documentation/docs-page"
import McpContent from "@content/docs/mcp.mdx"
import mcpMarkdown from "@content/docs/mcp.mdx.source"
import { createFileRoute } from "@tanstack/react-router"

const DocumentationMcpPage = () => (
  <DocsPage
    title="MCP Interface"
    description="Set up Claude Code, Codex, or Cursor, add authentication when needed, and investigate tasks and workers."
    group="Reference"
    source={{ path: "src/content/docs/mcp.mdx", markdown: mcpMarkdown }}
    previousPage={{ title: "Configuration", href: "/documentation/configuration" }}
    nextPage={{ title: "Deployment Patterns", href: "/documentation/deployment-patterns" }}
  >
    <McpContent />
  </DocsPage>
)

export const Route = createFileRoute("/documentation/mcp")({
  component: DocumentationMcpPage,
})
