import DocsPage from "@components/documentation/docs-page"
import ConfigurationContent from "@content/docs/configuration.mdx"
import configurationMarkdown from "@content/docs/configuration.mdx.source"
import { createFileRoute } from "@tanstack/react-router"

const DocumentationConfigurationPage = () => (
  <DocsPage
    title="Configuration"
    description="TOML settings, environment overrides and secret sources."
    group="Reference"
    source={{ path: "src/content/docs/configuration.mdx", markdown: configurationMarkdown }}
    previousPage={{ title: "Quick Start", href: "/documentation/setup" }}
    nextPage={{ title: "Authentication & Authorization", href: "/documentation/authentication" }}
  >
    <ConfigurationContent />
  </DocsPage>
)

export const Route = createFileRoute("/documentation/configuration")({
  component: DocumentationConfigurationPage,
})
