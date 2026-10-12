import DocsPage from "@components/documentation/docs-page"
import DeploymentPatternsContent from "@content/docs/deployment-patterns.mdx"
import deploymentPatternsMarkdown from "@content/docs/deployment-patterns.mdx.source"
import { createFileRoute } from "@tanstack/react-router"

const DocumentationDeploymentPatternsPage = () => (
  <DocsPage
    title="Deployment Patterns"
    description="Choose memory, persistent disk or shared external storage."
    group="Reference"
    source={{ path: "src/content/docs/deployment-patterns.mdx", markdown: deploymentPatternsMarkdown }}
    previousPage={{ title: "MCP Interface", href: "/documentation/mcp" }}
    nextPage={{ title: "Kubernetes and HPA", href: "/documentation/kubernetes" }}
  >
    <DeploymentPatternsContent />
  </DocsPage>
)

export const Route = createFileRoute("/documentation/deployment-patterns")({
  component: DocumentationDeploymentPatternsPage,
})
