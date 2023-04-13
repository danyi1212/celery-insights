import CeleryStateSync from "@components/CeleryStateSync"
import { usePreferredTheme } from "@hooks/usePreferredTheme"
import CssBaseline from "@mui/material/CssBaseline"
import { ThemeProvider } from "@mui/material/styles"
import React from "react"
import { QueryClient, QueryClientProvider } from "react-query"

const queryClient = new QueryClient()

interface Props {
    children: React.ReactElement
}

const ConsolidatedProviders: React.FC<Props> = ({ children }) => {
    const theme = usePreferredTheme()
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <CeleryStateSync />
                {children}
            </ThemeProvider>
        </QueryClientProvider>
    )
}

export default ConsolidatedProviders
