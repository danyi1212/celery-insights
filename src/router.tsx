import { getUrlPrefix } from "./lib/app-url"
import { createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"

export const getRouter = () =>
  createRouter({
    routeTree,
    basepath: getUrlPrefix() || "/",
    scrollRestoration: true,
  })

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
