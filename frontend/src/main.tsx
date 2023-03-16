import { ThemeProvider } from "@emotion/react"
import { CssBaseline } from "@mui/material"
import * as React from "react"
import * as ReactDOM from "react-dom/client"
import App from "./App"
import ContextFetcher from "./components/ContextFetcher"
import theme from "./theme"

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <ContextFetcher>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <App />
            </ThemeProvider>
        </ContextFetcher>
    </React.StrictMode>
)
