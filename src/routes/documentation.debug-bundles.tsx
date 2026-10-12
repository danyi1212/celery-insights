import DocsPage from "@components/documentation/docs-page"
import DebugBundlesContent from "@content/docs/debug-bundles.mdx"
import debugBundlesMarkdown from "@content/docs/debug-bundles.mdx.source"
import { createFileRoute } from "@tanstack/react-router"

const DocumentationDebugBundlesPage = () => (
  <DocsPage
    title="Debug Bundles"
    description="Capture diagnostics and replay task history offline."
    group="Operations"
    source={{ path: "src/content/docs/debug-bundles.mdx", markdown: debugBundlesMarkdown }}
    previousPage={{ title: "Production Notes", href: "/documentation/production-notes" }}
  >
    <DebugBundlesContent />
  </DocsPage>
)

export const Route = createFileRoute("/documentation/debug-bundles")({
  component: DocumentationDebugBundlesPage,
})
