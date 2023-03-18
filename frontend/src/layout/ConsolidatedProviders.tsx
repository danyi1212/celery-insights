import CeleryStateSync from "@components/CeleryStateSync"
import CssBaseline from "@mui/material/CssBaseline"
import { ThemeProvider } from "@mui/material/styles"
import theme from "@theme"
import React from "react"

interface Props {
    children: React.ReactElement
}

const ConsolidatedProviders: React.FC<Props> = ({ children }) => {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <CeleryStateSync />
            {children}
        </ThemeProvider>
    )
}

export default ConsolidatedProviders
