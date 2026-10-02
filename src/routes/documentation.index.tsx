import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/documentation/")({
  beforeLoad: () => {
    throw redirect({ to: "/documentation/setup" })
  },
})
