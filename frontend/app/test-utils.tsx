import { render, type RenderOptions } from "@testing-library/react"
import { TooltipProvider } from "@components/ui/tooltip"
import type { ReactElement } from "react"

const AllProviders = ({ children }: { children: React.ReactNode }) => <TooltipProvider>{children}</TooltipProvider>

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) =>
    render(ui, { wrapper: AllProviders, ...options })

export * from "@testing-library/react"
export { customRender as render }
