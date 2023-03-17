import CeleryStateSync from "@components/CeleryStateSync"
import { CssBaseline, ThemeProvider } from "@mui/material"
import { router } from "@router"
import theme from "@theme"
import * as React from "react"
import * as ReactDOM from "react-dom/client"
import { RouterProvider } from "react-router-dom"

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <ThemeProvider theme={theme}>
            <CeleryStateSync />
            <CssBaseline />
            <RouterProvider router={router} />
        </ThemeProvider>
    </React.StrictMode>
)
