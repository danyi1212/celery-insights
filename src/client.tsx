import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "@tanstack/react-router"
import { Analytics } from "@vercel/analytics/react"
import { getRouter } from "./router"
import "./styles.css"

const router = getRouter()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <>
      <RouterProvider router={router} />
      <Analytics />
    </>
  </StrictMode>,
)
