import DocsPage from "@components/documentation/docs-page"
import CeleryClustersContent from "@content/docs/celery-clusters.mdx"
import celeryClustersMarkdown from "@content/docs/celery-clusters.mdx.source"
import { createFileRoute } from "@tanstack/react-router"

const DocumentationCeleryClustersPage = () => (
  <DocsPage
    title="Celery Cluster Setups"
    description="How to connect the app to common Celery layouts and when a config file is required."
    group="Operations"
    source={{ path: "src/content/docs/celery-clusters.mdx", markdown: celeryClustersMarkdown }}
    previousPage={{ title: "Kubernetes and HPA", href: "/documentation/kubernetes" }}
    nextPage={{ title: "Production Notes", href: "/documentation/production-notes" }}
  >
    <CeleryClustersContent />
  </DocsPage>
)

export const Route = createFileRoute("/documentation/celery-clusters")({
  component: DocumentationCeleryClustersPage,
})
