import DocsPage from "@components/documentation/docs-page"
import ProductionNotesContent from "@content/docs/production-notes.mdx"
import productionNotesMarkdown from "@content/docs/production-notes.mdx.source"
import { createFileRoute } from "@tanstack/react-router"

const DocumentationProductionNotesPage = () => (
    <DocsPage
        title="Production Notes"
        description="Metrics, health checks, TLS, security, and scaling behavior once the app is live."
        group="Operations"
        source={{ path: "frontend/app/content/docs/production-notes.mdx", markdown: productionNotesMarkdown }}
        previousPage={{ title: "Celery Cluster Setups", href: "/documentation/celery-clusters" }}
    >
        <ProductionNotesContent />
    </DocsPage>
)

export const Route = createFileRoute("/documentation/production-notes")({
    component: DocumentationProductionNotesPage,
})
