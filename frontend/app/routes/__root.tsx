import { createRootRoute, Outlet, Link as RouterLink } from "@tanstack/react-router"
import { ReadOnlyBanner } from "@components/connection-status"
import CeleryStateSync from "@components/celery-state-sync"
import DemoSimulator from "@components/demo-simulator"
import SurrealDBProvider from "@components/surrealdb-provider"
import { useDarkMode } from "@hooks/use-dark-mode"
import Header from "@layout/header/header"
import JoyrideTour from "@layout/joyride-tour"
import Menu from "@layout/menu/menu"
import useSettingsStore from "@stores/use-settings-store"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SidebarInset, SidebarProvider } from "@components/ui/sidebar"
import { TooltipProvider } from "@components/ui/tooltip"

const queryClient = new QueryClient()

const RootComponent = () => {
    const isDemo = useSettingsStore((state) => state.demo)
    useDarkMode()
    return (
        <QueryClientProvider client={queryClient}>
            {isDemo ? <DemoSimulator /> : <CeleryStateSync />}
            <SurrealDBProvider>
                <SidebarProvider>
                    <Menu />
                    <SidebarInset>
                        <ReadOnlyBanner />
                        <Header />
                        <div className="flex-1 p-0">
                            <Outlet />
                        </div>
                    </SidebarInset>
                    <JoyrideTour />
                </SidebarProvider>
            </SurrealDBProvider>
        </QueryClientProvider>
    )
}

const ErrorComponent = ({ error }: { error: Error }) => {
    console.error(error)
    return (
        <TooltipProvider>
            <div className="min-h-screen flex justify-center items-center flex-col bg-background text-foreground">
                <h1 className="text-4xl font-bold">{error.name}</h1>
                <p className="text-xl mt-2">{error.message}</p>
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
