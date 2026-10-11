import { useState } from "react"
import { createRootRoute, Outlet, Link as RouterLink, type ErrorComponentProps } from "@tanstack/react-router"
import { ReadOnlyBanner } from "@components/connection-status"
import { AppKeyboardShortcuts } from "@components/keyboard/app-keyboard-shortcuts"
import { SearchBoxControllerProvider } from "@components/search/search-box-controller"
import SurrealDBProvider from "@components/surrealdb-provider"
import { useDarkMode } from "@hooks/use-dark-mode"
import { KeyboardShortcutsProvider } from "@hooks/use-keyboard-shortcuts"
import Header from "@layout/header/header"
import JoyrideTour from "@layout/joyride-tour"
import Menu from "@layout/menu/menu"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SidebarInset, SidebarProvider } from "@components/ui/sidebar"
import { TooltipProvider } from "@components/ui/tooltip"
import { NuqsAdapter } from "nuqs/adapters/react"

// Mounted inside the connection boundary: reconnects and scope changes discard observation caches.
const Application = () => {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <ApplicationLayout />
    </QueryClientProvider>
  )
}

const ApplicationLayout = () => (
  <SidebarProvider>
    <KeyboardShortcutsProvider>
      <SearchBoxControllerProvider>
        <AppKeyboardShortcuts />
        <Menu />
        <SidebarInset>
          <ReadOnlyBanner />
          <Header />
          <div className="flex-1 p-0">
            <Outlet />
          </div>
        </SidebarInset>
        <JoyrideTour />
      </SearchBoxControllerProvider>
    </KeyboardShortcutsProvider>
  </SidebarProvider>
)

const RootComponent = () => {
  useDarkMode()
  return (
    <NuqsAdapter>
      <SurrealDBProvider>
        <Application />
      </SurrealDBProvider>
    </NuqsAdapter>
  )
}

const ErrorComponent = ({ error }: ErrorComponentProps) => {
  console.error(error)
  const displayError = error instanceof Error ? error : new Error(String(error))
  return (
    <TooltipProvider>
      <div className="min-h-screen flex justify-center items-center flex-col bg-background text-foreground">
        <h1 className="text-4xl font-bold">{displayError.name}</h1>
        <p className="text-xl mt-2">{displayError.message}</p>
        <RouterLink to="/" className="text-primary underline mt-4">
          Back Home
        </RouterLink>
      </div>
    </TooltipProvider>
  )
}

const NotFoundComponent = () => {
  return (
    <TooltipProvider>
      <div className="min-h-screen flex justify-center items-center flex-col bg-background text-foreground">
        <h1 className="text-4xl font-bold">404 Not Found</h1>
        <p className="text-xl mt-2">Sorry, the page you are looking for does not exist.</p>
        <RouterLink to="/" className="text-primary underline mt-4">
          Back Home
        </RouterLink>
      </div>
    </TooltipProvider>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: ErrorComponent,
  notFoundComponent: NotFoundComponent,
})
