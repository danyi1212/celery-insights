import DocsPage from "@components/documentation/docs-page"
import SetupContent from "@content/docs/setup.mdx"
import setupMarkdown from "@content/docs/setup.mdx.source"
import { createFileRoute } from "@tanstack/react-router"

const DocumentationSetupPage = () => (
  <DocsPage
    title="Quick Start"
    description="Choose a topology, set the core variables, and bring Celery Insights online in the right order."
    group="Getting Started"
    source={{ path: "src/content/docs/setup.mdx", markdown: setupMarkdown }}
    nextPage={{ title: "Configuration", href: "/documentation/configuration" }}
  >
    <SetupContent />
  </DocsPage>
)

export const Route = createFileRoute("/documentation/setup")({
  component: DocumentationSetupPage,
})
