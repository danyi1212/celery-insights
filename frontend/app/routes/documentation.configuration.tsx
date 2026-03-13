import DocsPage from "@components/documentation/docs-page"
import ConfigurationContent from "@content/docs/configuration.mdx"
import configurationMarkdown from "@content/docs/configuration.mdx.source"
import { createFileRoute } from "@tanstack/react-router"

const DocumentationConfigurationPage = () => (
    <DocsPage
        title="Configuration"
        description="Environment variables and operational defaults exposed by the container entrypoint."
        group="Reference"
        source={{ path: "frontend/app/content/docs/configuration.mdx", markdown: configurationMarkdown }}
        previousPage={{ title: "Quick Start", href: "/documentation/setup" }}
        nextPage={{ title: "Deployment Patterns", href: "/documentation/deployment-patterns" }}
    >
        <ConfigurationContent />
    </DocsPage>
)

export const Route = createFileRoute("/documentation/configuration")({
    component: DocumentationConfigurationPage,
})
