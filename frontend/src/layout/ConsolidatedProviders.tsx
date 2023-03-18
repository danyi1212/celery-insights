import CeleryStateSync from "@components/CeleryStateSync"
import CssBaseline from "@mui/material/CssBaseline"
import { ThemeProvider } from "@mui/material/styles"
import theme from "@theme"
import React from "react"
import { QueryClient, QueryClientProvider } from "react-query"

const queryClient = new QueryClient()

interface Props {
    children: React.ReactElement
}

const ConsolidatedProviders: React.FC<Props> = ({ children }) => {
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
