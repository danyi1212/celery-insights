import DocsPage from "@components/documentation/docs-page"
import DeploymentPatternsContent from "@content/docs/deployment-patterns.mdx"
import deploymentPatternsMarkdown from "@content/docs/deployment-patterns.mdx.source"
import { createFileRoute } from "@tanstack/react-router"

const DocumentationDeploymentPatternsPage = () => (
    <DocsPage
        title="Deployment Patterns"
        description="Memory, local disk, shared external SurrealDB, and advanced ingestion-control patterns."
        group="Reference"
        source={{ path: "frontend/app/content/docs/deployment-patterns.mdx", markdown: deploymentPatternsMarkdown }}
        previousPage={{ title: "Configuration", href: "/documentation/configuration" }}
        nextPage={{ title: "Kubernetes and HPA", href: "/documentation/kubernetes" }}
    >
        <DeploymentPatternsContent />
    </DocsPage>
)

export const Route = createFileRoute("/documentation/deployment-patterns")({
    component: DocumentationDeploymentPatternsPage,
})
