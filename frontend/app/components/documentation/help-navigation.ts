export const helpNavigation = [
    {
        title: "Quick Start",
        href: "/documentation/setup",
        description: "Fastest path to a working install.",
        group: "Getting Started",
    },
    {
        title: "Configuration",
        href: "/documentation/configuration",
        description: "Full environment variable reference.",
        group: "Reference",
    },
    {
        title: "Deployment Patterns",
        href: "/documentation/deployment-patterns",
        description: "Choose the right SurrealDB topology.",
        group: "Reference",
    },
    {
        title: "Kubernetes and HPA",
        href: "/documentation/kubernetes",
        description: "Stateless deployment guidance and manifests.",
        group: "Operations",
    },
    {
        title: "Celery Cluster Setups",
        href: "/documentation/celery-clusters",
        description: "Broker patterns, events, and advanced config.",
        group: "Operations",
    },
    {
        title: "Production Notes",
        href: "/documentation/production-notes",
        description: "Guardrails for real deployments.",
        group: "Operations",
    },
] as const

export const matchHelpNavigation = (query: string) => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
        return helpNavigation
    }

    return helpNavigation.filter((page) =>
        [page.title, page.description, page.group, "documentation", "docs", "help"]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery),
    )
}
