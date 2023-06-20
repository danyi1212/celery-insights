import { router } from "@router"
import { inject } from "@vercel/analytics"
import * as React from "react"
import * as ReactDOM from "react-dom/client"
import { RouterProvider } from "react-router-dom"

if (import.meta.env.VITE_DEMO_MODE) {
    inject()
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>
)
