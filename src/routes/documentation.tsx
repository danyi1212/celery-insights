import DocsShell from "@components/documentation/docs-shell"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/documentation")({
  component: DocsShell,
})
