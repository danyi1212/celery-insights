import DocsPage from "@components/documentation/docs-page"
import KubernetesContent from "@content/docs/kubernetes.mdx"
import kubernetesMarkdown from "@content/docs/kubernetes.mdx.source"
import { createFileRoute } from "@tanstack/react-router"

const DocumentationKubernetesPage = () => (
  <DocsPage
    title="Kubernetes and HPA"
    description="Recommended manifests, probes, replica strategy, and autoscaling guardrails."
    group="Operations"
    source={{ path: "src/content/docs/kubernetes.mdx", markdown: kubernetesMarkdown }}
    previousPage={{ title: "Deployment Patterns", href: "/documentation/deployment-patterns" }}
    nextPage={{ title: "Celery Cluster Setups", href: "/documentation/celery-clusters" }}
  >
    <KubernetesContent />
  </DocsPage>
)

export const Route = createFileRoute("/documentation/kubernetes")({
  component: DocumentationKubernetesPage,
})
