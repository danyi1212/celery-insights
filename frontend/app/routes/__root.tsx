import { createRootRoute, Outlet, Link as RouterLink } from "@tanstack/react-router"
import ConsolidatedProviders from "@layout/ConsolidatedProviders"
import Header from "@layout/header/Header"
import JoyrideTour from "@layout/JoyrideTour"
import Menu from "@layout/menu/Menu"
import { SidebarInset, SidebarProvider } from "@components/ui/sidebar"
import { TooltipProvider } from "@components/ui/tooltip"

const RootComponent = () => {
    return (
        <ConsolidatedProviders>
            <SidebarProvider>
                <Menu />
                <SidebarInset>
                    <Header />
                    <div className="flex-1 p-0">
                        <Outlet />
                    </div>
                </SidebarInset>
                <JoyrideTour />
            </SidebarProvider>
        </ConsolidatedProviders>
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
