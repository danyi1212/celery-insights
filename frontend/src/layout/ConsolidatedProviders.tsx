import CeleryStateSync from "@components/CeleryStateSync"
import DemoSimulator from "@components/DemoSimulator"
import { usePreferredTheme } from "@hooks/usePreferredTheme"
import CssBaseline from "@mui/material/CssBaseline"
import { ThemeProvider } from "@mui/material/styles"
import useSettingsStore from "@stores/useSettingsStore"
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const queryClient = new QueryClient()

interface Props {
    children: React.ReactElement
}

const ConsolidatedProviders: React.FC<Props> = ({ children }) => {
    const theme = usePreferredTheme()
    const isDemo = useSettingsStore((state) => state.demo)
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {isDemo ? <DemoSimulator /> : <CeleryStateSync />}
                {children}
            </ThemeProvider>
        </QueryClientProvider>
    )
}

export default ConsolidatedProviders
