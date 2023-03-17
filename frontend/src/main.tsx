import CeleryStateSync from "@components/CeleryStateSync"
import { ThemeProvider } from "@emotion/react"
import { CssBaseline } from "@mui/material"
import * as React from "react"
import * as ReactDOM from "react-dom/client"
import App from "./App"
import theme from "./theme"

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <ThemeProvider theme={theme}>
            <CeleryStateSync />
            <CssBaseline />
            <App />
        </ThemeProvider>
    </React.StrictMode>
)
