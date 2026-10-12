import DocsPage from "@components/documentation/docs-page"
import AuthenticationContent from "@content/docs/authentication.mdx"
import authenticationMarkdown from "@content/docs/authentication.mdx.source"
import { createFileRoute } from "@tanstack/react-router"

const DocumentationAuthenticationPage = () => (
  <DocsPage
    title="Authentication & Authorization"
    description="Configure password accounts or SSO, then limit access with roles and policies."
    group="Reference"
    source={{ path: "src/content/docs/authentication.mdx", markdown: authenticationMarkdown }}
    previousPage={{ title: "Configuration", href: "/documentation/configuration" }}
    nextPage={{ title: "MCP Interface", href: "/documentation/mcp" }}
  >
    <AuthenticationContent />
  </DocsPage>
)

export const Route = createFileRoute("/documentation/authentication")({
  component: DocumentationAuthenticationPage,
})
